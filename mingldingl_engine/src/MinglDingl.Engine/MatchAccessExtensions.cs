using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

public static class MatchAccessExtensions
{
    public static async Task<(Match Match, IActionResult? Error)> LoadParticipantMatchAsync(
        this ControllerBase c, AppDbContext db, Guid matchId, bool tracked = true, bool requireActive = false)
    {
        var match = tracked
            ? await db.Matches.FindAsync(matchId)
            : await db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);

        if (match is null) return (null!, c.NotFoundError("Match not found", "match.not_found"));
        if (!match.IsParticipant(c.CurrentUserId()))
            return (null!, c.ForbiddenError("You are not a participant in this match", "match.not_participant"));
        if (requireActive && match.Status != "Active")
            return (null!, c.ForbiddenError("This match is no longer active", "match.inactive"));
        return (match, null);
    }
}
