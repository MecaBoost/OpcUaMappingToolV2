using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Xml.Linq;
using OpcUaMappingTool.Web.Models.Dtos;
using OpcUaMappingTool.Web.Utils;

namespace OpcUaMappingTool.Web.Services
{
    public class OpcUaAssetExtractionServiceV2
    {
        private static readonly XNamespace NsUa = "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd";
        private static readonly XName UAObjectName = NsUa + "UAObject";
        private static readonly XName ReferenceName = NsUa + "Reference";

        // =========================================================
        // EXTRACTION XML (Sécurisée avec OpcUaXmlHelper)
        // =========================================================
        public async Task<List<string>> ExtractXmlAssetsAsync(Stream xmlStream)
        {
            var doc = await XDocument.LoadAsync(xmlStream, LoadOptions.None, default);
            
            var allObjects = doc.Descendants(UAObjectName).ToList();
            
            var nodesById = doc.Descendants().Where(e => e.Attribute("NodeId") != null)
                               .ToDictionary(e => e.Attribute("NodeId")!.Value, e => e);

            var level0Roots = new HashSet<string>();  
            var level1Assets = new HashSet<string>(); 

            foreach (var obj in allObjects)
            {
                var nodeId = obj.Attribute("NodeId")?.Value;
                if (string.IsNullOrEmpty(nodeId)) continue;

                var parentRef = obj.Descendants(ReferenceName)
                                   .FirstOrDefault(e => (string?)e.Attribute("IsForward") == "false");

                if (parentRef == null || !nodesById.ContainsKey(parentRef.Value))
                {
                    level0Roots.Add(nodeId);
                }
            }

            foreach (var obj in allObjects)
            {
                var nodeId = obj.Attribute("NodeId")?.Value;
                if (string.IsNullOrEmpty(nodeId)) continue;

                var parentRef = obj.Descendants(ReferenceName)
                                   .FirstOrDefault(e => (string?)e.Attribute("IsForward") == "false");

                if (parentRef != null && level0Roots.Contains(parentRef.Value))
                {
                    level1Assets.Add(nodeId);
                }
            }

            var targetNodeIds = level1Assets.ToHashSet();

            return allObjects.Where(obj => targetNodeIds.Contains(obj.Attribute("NodeId")?.Value ?? ""))
                             .Select(e => e.Attribute("BrowseName")?.Value)
                             .Where(v => !string.IsNullOrEmpty(v))
                             // Remplacement de Split(':').Last() par le Helper sécurisé
                             .Select(v => OpcUaXmlHelper.GetCleanName(v)) 
                             .Distinct()
                             .OrderBy(v => v) 
                             .ToList();
        }

        // =========================================================
        // EXTRACTION JSON (Optimisée avec les DTOs)
        // =========================================================
        public async Task<Dictionary<string, List<string>>> ExtractJsonAssetsAsync(Stream jsonStream)
        {
            var tempResult = new Dictionary<string, HashSet<string>>();
            var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            // 1. Désérialisation propre et fortement typée
            var root = await JsonSerializer.DeserializeAsync<JsonRoot>(jsonStream, jsonOptions);
            var connections = root?.Configs?.FirstOrDefault()?.Config?.Connections;

            if (connections == null) return new Dictionary<string, List<string>>();

            // 2. Traitement des données
            foreach (var conn in connections)
            {
                if (string.IsNullOrEmpty(conn.Name) || conn.Datapoints == null) continue;

                if (!tempResult.ContainsKey(conn.Name))
                {
                    tempResult[conn.Name] = new HashSet<string>();
                }

                foreach (var dp in conn.Datapoints)
                {
                    if (string.IsNullOrEmpty(dp.Name)) continue;

                    string[] parts = dp.Name.Split('.');

                    if (parts.Length >= 2)
                    {
                        string prefix = $"{parts[0]}.{parts[1]}";
                        tempResult[conn.Name].Add(prefix);
                    }
                    else if (parts.Length == 1)
                    {
                        tempResult[conn.Name].Add(parts[0]);
                    }
                }
            }
            
            // 3. Conversion finale pour l'affichage (Tri alphabétique)
            return tempResult.ToDictionary(k => k.Key, v => v.Value.OrderBy(p => p).ToList());
        }
    }
}