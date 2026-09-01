using System.ComponentModel.DataAnnotations;

public record CreateShipRequest(
    [Required, MaxLength(FieldLimits.Phone)] string SlotAPhoneNumber,
    [Required, MaxLength(FieldLimits.Phone)] string SlotBPhoneNumber);

public record CreateShipResponse(bool Success, string? Error, string? SlotACode = null, string? SlotBCode = null);

public record PendingShipResponse(Guid ShipId, string WeaverDisplayName);

public record RespondToShipRequest(bool Accept);
public record RespondToShipResponse(bool Sparked);
