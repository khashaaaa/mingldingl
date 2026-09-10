using System.Linq.Expressions;

/// <summary>
/// Who a given user may be offered, and therefore who they may summon. This lived inline in
/// <c>MatchesController.GetCandidates</c>'s SQL <c>Where</c>, so <c>POST /matches</c> — which never
/// consulted it — reached paused accounts, accounts pending deletion, people outside the caller's
/// stated age range, the caller themselves, and anyone of the caller's own gender. Both paths now
/// read the same expression: it is consumed as SQL by discovery and compiled for the single-target
/// check, so the two cannot drift apart again. Ships resolve their nominees through it too.
/// <para>
/// A ban is enforced in <c>CurrentUserMiddleware</c>, which only stops the banned account's own
/// requests — so without the <c>IsBanned</c> clause here a banned profile stayed in every discovery
/// feed and could still be summoned, spending a real daily slot on a match nobody could answer.
/// </para>
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
            && !u.IsBanned
            && u.Age >= ageMin && u.Age <= ageMax
            && oppositeGender != null && u.Gender == oppositeGender;
    }

    /// <summary>
    /// Eligible in both directions. A match is a two-sided thing — each side's age range has to
    /// admit the other — so this is the rule for any path that creates one from two known profiles.
    /// Fated Threads went straight from "both accepted" to a Match without consulting eligibility
    /// at all, which is a third path around a rule the other two share.
    /// </summary>
    public static bool AreMutuallyEligible(User a, User b) =>
        IsEligibleFor(a).Compile()(b) && IsEligibleFor(b).Compile()(a);

    /// <summary>
    /// The state clauses alone, for queries about a user in their own right rather than as someone's
    /// candidate: on a leaderboard, on a Town Square roster. Gender and age are relational and have
    /// no meaning here.
    /// </summary>
    public static Expression<Func<User, bool>> IsActiveAccount() =>
        u => u.DeletionRequestedAt == null && !u.IsBanned;
}
