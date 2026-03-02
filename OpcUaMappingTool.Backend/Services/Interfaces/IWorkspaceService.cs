using System.IO;
using System.Threading.Tasks;

namespace OpcUaMappingTool.Backend.Services.Interfaces
{
    public interface IWorkspaceService
    {
        Task SaveXmlAsync(string sessionId, Stream fileStream);
        Task SaveJsonAsync(string sessionId, Stream fileStream);
        Stream GetXmlStream(string sessionId);
        Stream GetJsonStream(string sessionId);
    }
}