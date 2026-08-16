public record SendMessageRequest(string Content);

public record MessageResponse(
    Guid Id,
    Guid MatchId,
    Guid SenderId,
    string Content,
    DateTime CreatedAt);

// Separate from MessageResponse (which is also what gets broadcast to the
// *other* participant over Supabase Realtime — that shape must never carry
// the sender's own Awarded, or a naive client could misapply it to the
// recipient's own score). Awarded is the sender's real total for this send
// (FirstMessage or MatchReply, plus any "message" daily-quest bonus) — 0 on
// sends that award neither (e.g. a second message before the other person
// has replied).
public record SendMessageResponse(MessageResponse Message, int Awarded = 0);
