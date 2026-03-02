using System.IO;
using System.Threading.Tasks;
using OpcUaMappingTool.Backend.Services.Interfaces;

namespace OpcUaMappingTool.Backend.Services
{
    public class WorkspaceService : IWorkspaceService
    {
        private readonly string _basePath = Path.Combine(Directory.GetCurrentDirectory(), "_workspaces");

        public WorkspaceService()
        {
            if (!Directory.Exists(_basePath)) Directory.CreateDirectory(_basePath);
        }

        private string GetSessionFolder(string sessionId)
        {
            var folder = Path.Combine(_basePath, sessionId);
            if (!Directory.Exists(folder)) Directory.CreateDirectory(folder);
            return folder;
        }

        public async Task SaveXmlAsync(string sessionId, Stream fileStream)
        {
            var path = Path.Combine(GetSessionFolder(sessionId), "model.xml");
            using var file = new FileStream(path, FileMode.Create, FileAccess.Write);
            await fileStream.CopyToAsync(file);
        }

        public async Task SaveJsonAsync(string sessionId, Stream fileStream)
        {
            var path = Path.Combine(GetSessionFolder(sessionId), "databus.json");
            using var file = new FileStream(path, FileMode.Create, FileAccess.Write);
            await fileStream.CopyToAsync(file);
        }

        public Stream GetXmlStream(string sessionId)
        {
            var path = Path.Combine(GetSessionFolder(sessionId), "model.xml");
            if (!File.Exists(path)) throw new FileNotFoundException("XML manquant pour cette session.");
            return new FileStream(path, FileMode.Open, FileAccess.Read);
        }

        public Stream GetJsonStream(string sessionId)
        {
            var path = Path.Combine(GetSessionFolder(sessionId), "databus.json");
            if (!File.Exists(path)) throw new FileNotFoundException("JSON manquant pour cette session.");
            return new FileStream(path, FileMode.Open, FileAccess.Read);
        }
    }
}