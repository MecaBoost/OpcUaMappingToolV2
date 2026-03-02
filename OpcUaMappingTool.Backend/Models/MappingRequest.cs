using System.Collections.Generic;

namespace OpcUaMappingTool.Backend.Models
{
    public class MappingRequest
    {
        public string SessionId { get; set; } = string.Empty;
        public List<UserMapping> Mappings { get; set; } = new();
    }

    public class UserMapping
    {
        public string XmlNode { get; set; } = string.Empty;
        public string JsonConnection { get; set; } = string.Empty;
        public string JsonPrefix { get; set; } = string.Empty;
    }
}