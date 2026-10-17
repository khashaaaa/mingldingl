using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Encounters;

/// Everything a bond can do beyond its letters, as one side sees it. next: the step the Bond's
/// card points to — attendance | icebreaker | trial | rite | meeting | rate — or null when nothing
/// waits. What the other person asked (their Rite, their pledge) comes before my own steps.
/// A step that has not opened yet is null.
public sealed record EncounterView(
    string? Next, IcebreakerView? Icebreaker, TrialView? Trial, RiteView? Rite, MeetingStepView? Meeting, EncounterRewards Rewards);

/// What each step pays (config), so the app never types a number in.
public sealed record EncounterRewards(int Icebreaker, int Trial, int Rite, int Meeting, int OathProven);

/// mine/theirs: their answer only once both answered (revealed).
public sealed record IcebreakerView(string Question, string? Mine, string? Theirs, bool Revealed);

/// mine: my choices so far, in order (the next question is mine.Count). result: once both finished.
public sealed record TrialView(IReadOnlyList<TrialQuestionView> Questions, IReadOnlyList<int> Mine, bool TheyFinished, TrialResultView? Result);

public sealed record TrialQuestionView(string Text, IReadOnlyList<string> Choices, IReadOnlyList<string> Hints);

/// same: how many of the five they answered alike; percent = same / 5. sameTopics / differTopics:
/// what the result line says they agree and differ on; theirs: their choices.
public sealed record TrialResultView(int Same, int Percent, IReadOnlyList<string> SameTopics, IReadOnlyList<string> DifferTopics, IReadOnlyList<int> Theirs);

/// state: open (anyone may propose) | proposedByMe | proposedByThem | accepted (a call may start) |
/// done. canProposeAt: after "not now", when the proposer may ask again. required: a meeting waits
/// for it. call: the live attempt, when one is running.
public sealed record RiteView(string State, DateTimeOffset? CanProposeAt, bool Required, CallView? Call);

/// A call attempt. endsAt: when the five minutes run out (null until both are in).
public sealed record CallView(Guid Id, DateTimeOffset IssuedAt, DateTimeOffset? EndsAt, bool Ended, bool Completed);

/// open: a meeting may be chosen now (seal and Rite gates passed). current: the meeting under way,
/// if any — proposed, sworn, being checked, or just closed and still owed a rating.
public sealed record MeetingStepView(bool Open, string? Blocked, MeetingView? Current);

/// state: Proposed | Sworn | CalledOff | Checking | Closed. myAnswer: Met | NoShow | CouldNotGo.
/// outcome (closed): Kept | NoShow | Disputed | Excused | Unanswered. canRate: kept, not yet rated by me.
public sealed record MeetingView(
    Guid Id, VenueView Venue, DateTimeOffset At, bool ProposedByMe, bool MyPledge, bool TheirPledge, string State,
    DateTimeOffset? CheckUntil, string? MyAnswer, string? Outcome, bool CanRate);

public sealed record IcebreakerAnswerRequest([Required, StringLength(FieldLimits.Icebreaker)] string Text);

public sealed record TrialAnswerRequest(int Index, int Choice);

public sealed record MeetingProposal(Guid VenueId, DateTimeOffset At);

/// answer: Met | NoShow | CouldNotGo
public sealed record AttendanceRequest([Required, StringLength(12)] string Answer);

public sealed record RatingRequest(int Stars);
