namespace OpcUaMappingTool.Backend.Models
{
    public class MappingResult
    {
        public bool Success { get; set; }
        public int MappedCount { get; set; }
        public string Message { get; set; } = string.Empty;
        public byte[]? OutputXmlBytes { get; set; }
    }

    public class MappingInjectionOptions
    {
        public string SourceTemplate { get; set; } = "ie/d/j/simatic/v1/{appId}/dp/r/{conn}/default";
        public string AppInstanceId { get; set; } = "s7c1";
        public string TargetVariable { get; set; } = "var1";
        public string AccessRight { get; set; } = "3";
    }
}