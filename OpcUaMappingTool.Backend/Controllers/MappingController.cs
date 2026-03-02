using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using OpcUaMappingTool.Backend.Models;
using OpcUaMappingTool.Backend.Services.Interfaces;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace OpcUaMappingTool.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MappingController : ControllerBase
    {
        private readonly IWorkspaceService _workspaceService;
        private readonly IOpcUaAssetExtractionService _extractionService;
        private readonly IOpcUaMappingService _mappingService;

        public MappingController(
            IWorkspaceService workspaceService,
            IOpcUaAssetExtractionService extractionService,
            IOpcUaMappingService mappingService)
        {
            _workspaceService = workspaceService;
            _extractionService = extractionService;
            _mappingService = mappingService;
        }

        [HttpPost("upload-xml")]
        public async Task<IActionResult> UploadXml(IFormFile file, [FromForm] string? sessionId = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier XML manquant.");

            sessionId ??= Guid.NewGuid().ToString(); // Crée une session si elle n'existe pas

            // 1. Sauvegarde du fichier sur le serveur
            using var stream = file.OpenReadStream();
            await _workspaceService.SaveXmlAsync(sessionId, stream);

            // 2. Extraction des données
            using var readStream = _workspaceService.GetXmlStream(sessionId);
            var assets = await _extractionService.ExtractXmlAssetsAsync(readStream);

            return Ok(new { SessionId = sessionId, Assets = assets });
        }

        [HttpPost("upload-json")]
        public async Task<IActionResult> UploadJson(IFormFile file, [FromForm] string? sessionId = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier JSON manquant.");
            
            sessionId ??= Guid.NewGuid().ToString();

            using var stream = file.OpenReadStream();
            await _workspaceService.SaveJsonAsync(sessionId, stream);

            using var readStream = _workspaceService.GetJsonStream(sessionId);
            var assets = await _extractionService.ExtractJsonAssetsAsync(readStream);

            return Ok(new { SessionId = sessionId, Assets = assets });
        }

        [HttpPost("generate")]
        public async Task<IActionResult> GenerateMapping([FromBody] MappingRequest request)
        {
            if (string.IsNullOrEmpty(request.SessionId)) return BadRequest("SessionId requis.");
            if (request.Mappings == null || !request.Mappings.Any()) return BadRequest("Aucune liaison fournie.");

            try
            {
                using var xmlStream = _workspaceService.GetXmlStream(request.SessionId);
                using var jsonStream = _workspaceService.GetJsonStream(request.SessionId);

                // Conversion de la liste front-end en dictionnaire pour le service métier
                var deviceMappingDict = request.Mappings.ToDictionary(
                    m => m.XmlNode, 
                    m => (m.JsonConnection, m.JsonPrefix)
                );

                var result = await _mappingService.ProcessMappingAsync(jsonStream, xmlStream, deviceMappingDict);

                if (result.Success && result.OutputXmlBytes != null)
                {
                    // Retourne le fichier binaire au navigateur
                    return File(result.OutputXmlBytes, "application/xml", "urn.ComapanMeca4_Automated.xml");
                }

                return BadRequest(result.Message);
            }
            catch (FileNotFoundException)
            {
                return NotFound("Fichiers de session introuvables. Veuillez les uploader à nouveau.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur interne : {ex.Message}");
            }
        }
    }
}