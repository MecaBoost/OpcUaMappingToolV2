using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using OpcUaMappingTool.Web.Models;

namespace OpcUaMappingTool.Web.Services.Interfaces
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