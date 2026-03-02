using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using OpcUaMappingTool.Backend.Services;
using OpcUaMappingTool.Backend.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// 1. Ajouter le support des Contrôleurs API
builder.Services.AddControllers();

// 2. Configuration Swagger pour tester l'API facilement
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 3. Configuration CORS (pour autoriser le frontend HTML/JS à appeler l'API)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin => true) 
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 4. Injection des dépendances (les services que nous allons créer/importer juste après)
builder.Services.AddScoped<IWorkspaceService, WorkspaceService>();
builder.Services.AddScoped<IOpcUaAssetExtractionService, OpcUaAssetExtractionService>();
builder.Services.AddScoped<IOpcUaMappingService, OpcUaMappingService>();

var app = builder.Build();

// Configuration du pipeline HTTP
app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowFrontend");
app.UseAuthorization();
app.MapControllers();

app.Run();