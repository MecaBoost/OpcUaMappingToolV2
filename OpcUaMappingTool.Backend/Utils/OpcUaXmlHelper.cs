using System.Text.RegularExpressions;

namespace OpcUaMappingTool.Backend.Utils
{
    public static class OpcUaXmlHelper
    {
        // Remplace Split(':').Last() pour gérer les noms contenant plusieurs ':'
        public static string GetCleanName(string? browseName)
        {
            if (string.IsNullOrEmpty(browseName)) return string.Empty;
            int colonIndex = browseName.IndexOf(':');
            return colonIndex >= 0 ? browseName.Substring(colonIndex + 1) : browseName;
        }

        public static string FormatNodeName(string name)
        {
            if (string.IsNullOrEmpty(name)) return string.Empty;
            return Regex.Replace(name, @"_(\d+)$", "[$1]");
        }
    }
}