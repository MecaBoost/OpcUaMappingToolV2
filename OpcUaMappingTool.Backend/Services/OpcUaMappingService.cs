using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Linq;
using Microsoft.Extensions.Logging;
using OpcUaMappingTool.Web.Models;
using OpcUaMappingTool.Web.Models.Dtos;
using OpcUaMappingTool.Web.Services.Interfaces;
using OpcUaMappingTool.Web.Utils;

namespace OpcUaMappingTool.Web.Services
{
    public class OpcUaMappingService : IOpcUaMappingService
    {
        private static readonly XNamespace NsUa = "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd";
        private static readonly XNamespace NsSem = "http://this.is/semantica.xsd";
        private static readonly XName UAVariableName = NsUa + "UAVariable";
        private static readonly XName ReferenceName = NsUa + "Reference";
        private static readonly XName ExtensionsName = NsUa + "Extensions";

        private readonly ILogger<OpcUaMappingService> _logger;

        public OpcUaMappingService(ILogger<OpcUaMappingService> logger)
        {
            _logger = logger;
        }

        public async Task<MappingResult> ProcessMappingAsync(
            Stream jsonStream, 
            Stream xmlInputStream, 
            Dictionary<string, (string ConnectionName, string TargetPrefix)> deviceMapping,
            MappingInjectionOptions? options = null)
        {
            options ??= new MappingInjectionOptions();
            try
            {
                var jsonVars = await LoadJsonVariablesAsync(jsonStream);
                var doc = await XDocument.LoadAsync(xmlInputStream, LoadOptions.None, default);

                var nodesById = doc.Descendants()
                                   .Where(e => e.Attribute("NodeId") != null)
                                   .ToDictionary(e => e.Attribute("NodeId")!.Value, e => e);

                int mappedCount = 0;
                var visitedNodeIds = new HashSet<string>();

                foreach (XElement varElement in doc.Descendants(UAVariableName))
                {
                    // Optionnel : on pourrait vérifier ici si l'extension "semantica" existe déjà.
                    
                    string initialBrowseName = varElement.Attribute("BrowseName")?.Value ?? string.Empty;
                    var pathComponents = new List<string> { OpcUaXmlHelper.GetCleanName(initialBrowseName) }; 
                    
                    XElement currentNode = varElement;
                    string? foundRootDevice = null;
                    
                    visitedNodeIds.Clear(); // Réutilisation de l'allocation pour les performances

                    while (true)
                    {
                        string currentNodeId = currentNode.Attribute("NodeId")?.Value ?? string.Empty;
                        if (!visitedNodeIds.Add(currentNodeId)) break;

                        // Sécurisation : on ignore HasTypeDefinition (souvent i=40) pour ne pas sortir de l'arbre d'instances
                        XElement? parentRef = currentNode.Descendants(ReferenceName)
                             .FirstOrDefault(e => 
                                 (string?)e.Attribute("IsForward") == "false" && 
                                 (string?)e != "i=40" && 
                                 (string?)e != "HasTypeDefinition");

                        if (parentRef == null || !nodesById.TryGetValue(parentRef.Value, out XElement? parentNode))
                            break;

                        string parentCleanName = OpcUaXmlHelper.GetCleanName(parentNode.Attribute("BrowseName")?.Value);

                        if (deviceMapping.ContainsKey(parentCleanName))
                        {
                            foundRootDevice = parentCleanName;
                            break;
                        }

                        pathComponents.Add(parentCleanName);
                        currentNode = parentNode;
                    }

                    if (foundRootDevice != null)
                    {
                        var (jsonConnName, jsonPrefix) = deviceMapping[foundRootDevice];
                        pathComponents.Reverse();
                        
                        string suffixPath = string.Join(".", pathComponents.Select(OpcUaXmlHelper.FormatNodeName));
                        string fullJsonPath = $"{jsonPrefix}.{suffixPath}";

                        if (jsonVars.TryGetValue((jsonConnName, fullJsonPath), out string? dataType))
                        {
                            InjectMappingExtension(varElement, dataType, jsonConnName, fullJsonPath, options);
                            mappedCount++;
                        }
                    }
                }

                using var memoryStream = new MemoryStream();
                doc.Save(memoryStream);

                return new MappingResult 
                { 
                    Success = true, 
                    MappedCount = mappedCount, 
                    Message = "Traitement terminé avec succès.",
                    OutputXmlBytes = memoryStream.ToArray()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur lors du traitement du mapping OPC UA.");
                return new MappingResult { Success = false, Message = $"Erreur lors du traitement : {ex.Message}" };
            }
        }

        private async Task<Dictionary<(string, string), string>> LoadJsonVariablesAsync(Stream jsonStream)
        {
            var jsonVars = new Dictionary<(string, string), string>();
            var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            var root = await JsonSerializer.DeserializeAsync<JsonRoot>(jsonStream, jsonOptions);
            var connections = root?.Configs?.FirstOrDefault()?.Config?.Connections;

            if (connections == null) return jsonVars;

            foreach (var conn in connections)
            {
                if (conn.Datapoints == null || string.IsNullOrEmpty(conn.Name)) continue;

                foreach (var dp in conn.Datapoints)
                {
                    if (!string.IsNullOrEmpty(dp.Name))
                    {
                        jsonVars[(conn.Name, dp.Name)] = dp.DataType ?? string.Empty;
                    }
                }
            }
            return jsonVars;
        }

        private void InjectMappingExtension(XElement varElement, string dataType, string connName, string fullPath, MappingInjectionOptions options)
        {
            string sourceValue = options.SourceTemplate
                                        .Replace("{appId}", options.AppInstanceId)
                                        .Replace("{conn}", connName);

            XAttribute semanticaPrefix = new XAttribute(XNamespace.Xmlns + "semantica", NsSem.NamespaceName);

            XElement extensionContent = new XElement(NsSem + "Mapping",
                semanticaPrefix, 
                new XElement(NsSem + "Variables",
                    new XElement(NsSem + "Variable",
                        new XAttribute("Id", $"iedatabus/{connName}"),
                        new XAttribute("Type", dataType),
                        new XAttribute("Source", sourceValue),
                        new XAttribute("Target", options.TargetVariable),
                        new XAttribute("Path", fullPath),
                        new XAttribute("AppInstanceId", options.AppInstanceId),
                        new XAttribute("ValueRank", "-1"),
                        new XAttribute("ArrayDimensions", ""),
                        new XAttribute("AccessRight", options.AccessRight)
                    )
                ),
                new XElement(NsSem + "Archive", "false"),
                new XElement(NsSem + "Expression", "var1")
            );

            // Ajout sécurisé : Si <Extensions> n'existe pas, on le crée.
            var extensionsNode = varElement.Element(ExtensionsName);
            if (extensionsNode == null)
            {
                extensionsNode = new XElement(ExtensionsName);
                varElement.Add(extensionsNode);
            }

            extensionsNode.Add(new XElement(NsUa + "Extension", extensionContent));
        }
    }
}