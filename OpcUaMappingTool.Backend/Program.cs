using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// 1. Ajouter le support des Contrôleurs (API)
builder.Services.AddControllers();

// 2. Ajouter Swagger pour documenter et tester l'API facilement
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 3. Configurer CORS pour autoriser le Frontend à communiquer avec l'API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // On autorise tout en local pour le développement (à restreindre en production)
        policy.SetIsOriginAllowed(origin => true) 
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// TODO: Nous injecterons nos services ici plus tard (Extraction, Mapping, Workspace)

var app = builder.Build();

// Configuration du pipeline HTTP
app.UseSwagger();
app.UseSwaggerUI(); // Interface de test disponible sur /swagger

app.UseCors("AllowFrontend"); // Activer le CORS défini plus haut
app.UseAuthorization();
app.MapControllers();

app.Run();