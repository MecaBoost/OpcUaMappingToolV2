using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using OpcUaMappingTool.Backend.Models;

namespace OpcUaMappingTool.Backend.Services.Interfaces
{
    public interface IOpcUaMappingService
    {
        Task<MappingResult> ProcessMappingAsync(
            Stream jsonStream, 
            Stream xmlInputStream, 
            Dictionary<string, (string ConnectionName, string TargetPrefix)> deviceMapping,
            MappingInjectionOptions? options = null);
    }
}