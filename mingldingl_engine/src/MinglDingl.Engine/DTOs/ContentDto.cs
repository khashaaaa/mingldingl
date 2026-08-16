// Both languages returned together — the client already owns locale
// selection (lib/i18n.ts) for every other piece of text in the app, so this
// just extends that pattern to server-stored document content instead of
// making the server parse a locale param.
public record ContentPageResponse(string Slug, string TitleEn, string TitleMn, string BodyEn, string BodyMn, DateTime UpdatedAt);
