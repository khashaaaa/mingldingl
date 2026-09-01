using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("matches/{matchId}/campaign")]
[Authorize]
[Produces("application/json")]
public class CampaignController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly CampaignService _campaign;

    public CampaignController(AppDbContext db, CampaignService campaign)
    {
        _db = db;
        _campaign = campaign;
    }

    [HttpGet]
    [ProducesResponseType(typeof(CampaignResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetCampaign(Guid matchId)
    {
        if (!_campaign.IsEnabled) return this.NotFoundError("The campaign is not enabled");

        var userId = this.CurrentUserId();
        // requireActive stays false: a ghosted match shows its frozen map, and already-cleared
        // rooms remain claimable — the campaign never punishes beyond what ghosting already did.
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId, tracked: false);
        if (accessError is not null) return accessError;

        return Ok(await _campaign.GetStateAsync(match, userId));
    }

    [HttpPost("rooms/{roomId}/claim")]
    [ProducesResponseType(typeof(ClaimCampaignRoomResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ClaimRoom(Guid matchId, string roomId)
    {
        if (!_campaign.IsEnabled) return this.NotFoundError("The campaign is not enabled");

        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, matchId, tracked: false);
        if (accessError is not null) return accessError;

        return Ok(await _campaign.ClaimAsync(match, userId, roomId));
    }
}
