using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace OpcUaMappingTool.Backend.Models.Dtos
{
    public record JsonRoot(
        [property: JsonPropertyName("configs")] List<JsonConfigWrapper> Configs
    );

    public record JsonConfigWrapper(
        [property: JsonPropertyName("config")] JsonConfig Config
    );

    public record JsonConfig(
        [property: JsonPropertyName("connections")] List<JsonConnection> Connections
    );

    public record JsonConnection(
        [property: JsonPropertyName("name")] string Name, 
        [property: JsonPropertyName("datapoints")] List<JsonDatapoint> Datapoints
    );

    public record JsonDatapoint(
        [property: JsonPropertyName("name")] string Name, 
        [property: JsonPropertyName("data_type")] string DataType
    );
}