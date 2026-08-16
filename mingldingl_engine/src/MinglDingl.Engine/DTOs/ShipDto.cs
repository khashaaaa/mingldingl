public record CreateShipRequest(string SlotAPhoneNumber, string SlotBPhoneNumber);

// SlotACode/SlotBCode are always populated on a successful response — even
// for a slot that resolved to an existing account — so the Weaver's client
// can put a code into both share messages without the response shape
// itself leaking which slot resolved to a real user. Only the AwaitingUser
// slot's code is actually redeemable server-side; the other is inert.
public record CreateShipResponse(bool Success, string? Error, string? SlotACode = null, string? SlotBCode = null);

// Deliberately carries nothing about the other slot — see the spec's
// privacy constraint. WeaverDisplayName is safe: the Weaver's identity is
// meant to be visible (it's the trust signal), only the other nominee's
// isn't.
public record PendingShipResponse(Guid ShipId, string WeaverDisplayName);

public record RespondToShipRequest(bool Accept);
public record RespondToShipResponse(bool Sparked);
