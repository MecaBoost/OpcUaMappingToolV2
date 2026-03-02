using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace OpcUaMappingTool.Backend.Services.Interfaces
{
    public interface IOpcUaAssetExtractionService
    {
        Task<List<string>> ExtractXmlAssetsAsync(Stream xmlStream);
        Task<Dictionary<string, List<string>>> ExtractJsonAssetsAsync(Stream jsonStream);
    }
}