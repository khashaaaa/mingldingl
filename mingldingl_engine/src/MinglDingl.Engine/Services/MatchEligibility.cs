using System.Linq.Expressions;

/// <summary>
/// Who a given user may be offered, and therefore who they may summon. This lived inline in
/// <c>MatchesController.GetCandidates</c>'s SQL <c>Where</c>, so <c>POST /matches</c> — which never
/// consulted it — reached paused accounts, accounts pending deletion, people outside the caller's
/// stated age range, the caller themselves, and anyone of the caller's own gender. Both paths now
/// read the same expression: it is consumed as SQL by discovery and compiled for the single-target
/// check, so the two cannot drift apart again.
/// </summary>
public static class MatchEligibility
{
    /// <summary>The gender this user is shown, or null when their gender is outside the known pair.</summary>
    public static string? OppositeGenderOf(User me) => me.Gender switch
    {
        "Male" => "Female",
        "Female" => "Male",
        _ => null,
    };

    /// <summary>
    /// Everything decidable from the two profiles alone. Blocks and already-existing matches are
    /// relationship state rather than eligibility, and stay with their own subqueries at the call sites.
    /// </summary>
    public static Expression<Func<User, bool>> IsEligibleFor(User me)
    {
        var oppositeGender = OppositeGenderOf(me);
        var meId = me.Id;
        int ageMin = me.AgeMin;
        int ageMax = me.AgeMax;

        return u => u.Id != meId
            && u.DeletionRequestedAt == null
            && !u.IsPaused
            && u.Age >= ageMin && u.Age <= ageMax
            && oppositeGender != null && u.Gender == oppositeGender;
    }
}
