public record CampaignRoomResponse(string RoomId, bool Cleared, bool Claimed, int BonusScore);

public record CampaignResponse(List<CampaignRoomResponse> Rooms, int ClearedCount, bool BossCleared, int VoicesMessageThreshold = 15);

public record ClaimCampaignRoomResponse(int Awarded, DroppedItem? DroppedItem = null);
