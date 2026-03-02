using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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
        private readonly ILogger<MappingController> _logger; // Ajout du logger

        public MappingController(
            IWorkspaceService workspaceService,
            IOpcUaAssetExtractionService extractionService,
            IOpcUaMappingService mappingService,
            ILogger<MappingController> logger)
        {
            _workspaceService = workspaceService;
            _extractionService = extractionService;
            _mappingService = mappingService;
            _logger = logger;
        }

        [HttpPost("upload-xml")]
        public async Task<IActionResult> UploadXml(IFormFile file, [FromForm] string? sessionId = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier XML manquant.");

            sessionId ??= Guid.NewGuid().ToString();
            _logger.LogInformation("Début de l'upload XML pour la session : {SessionId}", sessionId);

            using var stream = file.OpenReadStream();
            await _workspaceService.SaveXmlAsync(sessionId, stream);
            _logger.LogInformation("Fichier XML sauvegardé avec succès.");

            using var readStream = _workspaceService.GetXmlStream(sessionId);
            var assets = await _extractionService.ExtractXmlAssetsAsync(readStream);
            _logger.LogInformation("{Count} assets extraits du fichier XML.", assets.Count);

            return Ok(new { SessionId = sessionId, Assets = assets });
        }

        [HttpPost("upload-json")]
        public async Task<IActionResult> UploadJson(IFormFile file, [FromForm] string? sessionId = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier JSON manquant.");
            
            sessionId ??= Guid.NewGuid().ToString();
            _logger.LogInformation("Début de l'upload JSON pour la session : {SessionId}", sessionId);

            using var stream = file.OpenReadStream();
            await _workspaceService.SaveJsonAsync(sessionId, stream);
            _logger.LogInformation("Fichier JSON sauvegardé avec succès.");

            using var readStream = _workspaceService.GetJsonStream(sessionId);
            var assets = await _extractionService.ExtractJsonAssetsAsync(readStream);
            _logger.LogInformation("{Count} connexions extraites du fichier JSON.", assets.Count);

            return Ok(new { SessionId = sessionId, Assets = assets });
        }

        [HttpPost("generate")]
        public async Task<IActionResult> GenerateMapping([FromBody] MappingRequest request)
        {
            if (string.IsNullOrEmpty(request.SessionId)) return BadRequest("SessionId requis.");
            if (request.Mappings == null || !request.Mappings.Any()) return BadRequest("Aucune liaison fournie.");

            _logger.LogInformation("Début de la génération du mapping pour la session {SessionId} avec {Count} requêtes de liaison.", request.SessionId, request.Mappings.Count);

            try
            {
                using var xmlStream = _workspaceService.GetXmlStream(request.SessionId);
                using var jsonStream = _workspaceService.GetJsonStream(request.SessionId);

                var deviceMappingDict = request.Mappings.ToDictionary(
                    m => m.XmlNode, 
                    m => (m.JsonConnection, m.JsonPrefix)
                );

                var result = await _mappingService.ProcessMappingAsync(jsonStream, xmlStream, deviceMappingDict);

                if (result.Success && result.OutputXmlBytes != null)
                {
                    _logger.LogInformation("Génération terminée avec succès. Fichier prêt à être téléchargé.");
                    return File(result.OutputXmlBytes, "application/xml", "urn.ComapanMeca4_Automated.xml");
                }

                _logger.LogWarning("La génération du mapping a échoué : {Message}", result.Message);
                return BadRequest(result.Message);
            }
            catch (FileNotFoundException ex)
            {
                _logger.LogError(ex, "Fichiers de session introuvables.");
                return NotFound("Fichiers de session introuvables. Veuillez les uploader à nouveau.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erreur interne inattendue lors de la génération.");
                return StatusCode(500, $"Erreur interne : {ex.Message}");
            }
        }
    }
}