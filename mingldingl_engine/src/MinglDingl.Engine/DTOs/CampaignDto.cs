public record CampaignRoomResponse(string RoomId, bool Cleared, bool Claimed, int BonusScore);

public record CampaignResponse(List<CampaignRoomResponse> Rooms, int ClearedCount, bool BossCleared);

public record ClaimCampaignRoomResponse(int Awarded, DroppedItem? DroppedItem = null);
