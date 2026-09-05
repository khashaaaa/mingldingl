using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("public")]
public class PublicController : ControllerBase
{
    private readonly AppDbContext _db;
    public PublicController(AppDbContext db) => _db = db;

    [HttpGet("stats")]
    [ProducesResponseType(typeof(PublicStatsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats()
    {
        var since = DateTime.UtcNow.AddDays(-7);

        int activeDaters = await _db.ScoreEvents
            .Where(e => e.EventType == "DailyLogin" && e.CreatedAt >= since)
            .Select(e => e.UserId)
            .Distinct()
            .CountAsync();

        int newBonds = await _db.Matches.CountAsync(m => m.CreatedAt >= since);

        int dateConfirmedEvents = await _db.ScoreEvents
            .CountAsync(e => e.EventType == "DateConfirmed" && e.CreatedAt >= since);

        return Ok(new PublicStatsResponse(activeDaters, newBonds, dateConfirmedEvents / 2, DateTime.UtcNow));
    }

    [HttpGet]
    [Produces("text/html")]
    public ContentResult GetStatsPage() => Content(StatsPageHtml, "text/html");

    [HttpGet("ship-invite")]
    [ProducesResponseType(typeof(PublicShipInviteResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetShipInvite([FromQuery] string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return Ok(new PublicShipInviteResponse(false));

        var normalized = code.ToUpperInvariant();
        bool valid = await _db.Ships.AnyAsync(s =>
            s.Status == "Pending" && (s.SlotAInviteCode == normalized || s.SlotBInviteCode == normalized));
        return Ok(new PublicShipInviteResponse(valid));
    }

    [HttpGet("ship")]
    [Produces("text/html")]
    public ContentResult GetShipInvitePage() => Content(ShipInvitePageHtml, "text/html");

    private const string StatsPageHtml = """
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>MingldIngl — This Week in the Realm</title>
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
            background: #0A0B10; color: #EDE4D3;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 24px; box-sizing: border-box;
          }
          main { max-width: 480px; width: 100%; text-align: center; }
          h1 {
            font-size: 22px; letter-spacing: 1px; color: #F5A83C; margin: 0 0 8px;
          }
          p.sub { color: #8F97A3; margin: 0 0 32px; font-size: 14px; }
          .tiles { display: grid; grid-template-columns: 1fr; gap: 14px; }
          .tile {
            background: #12141C; border: 1px solid #4A5A6B; border-radius: 12px;
            padding: 20px; text-align: left;
          }
          .tile .value { font-size: 32px; font-weight: 700; color: #D97F1F; }
          .tile .label { font-size: 13px; color: #8F97A3; margin-top: 4px; }
          .loading, .error { color: #8F97A3; font-size: 14px; }
          footer { margin-top: 32px; font-size: 12px; color: #4A5A6B; }
        </style>
        </head>
        <body>
        <main>
          <h1>This Week in the Realm</h1>
          <p class="sub">Live activity across MingldIngl — updated in real time.</p>
          <div class="tiles" id="tiles">
            <p class="loading">Consulting the ledger…</p>
          </div>
          <footer id="asOf"></footer>
        </main>
        <script>
          fetch('/public/stats')
            .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
            .then(function (d) {
              document.getElementById('tiles').innerHTML =
                '<div class="tile"><div class="value">' + d.activeDatersThisWeek + '</div><div class="label">Active daters this week</div></div>' +
                '<div class="tile"><div class="value">' + d.newBondsThisWeek + '</div><div class="label">New bonds forged this week</div></div>' +
                '<div class="tile"><div class="value">' + d.datesConfirmedThisWeek + '</div><div class="label">Dates confirmed this week</div></div>';
              document.getElementById('asOf').textContent = 'As of ' + new Date(d.asOf).toLocaleString();
            })
            .catch(function () {
              document.getElementById('tiles').innerHTML = '<p class="error">The ledger is unreachable right now — try again shortly.</p>';
            });
        </script>
        </body>
        </html>
        """;

    private const string ShipInvitePageHtml = """
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>MingldIngl — A Thread Has Been Woven</title>
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
            background: #0A0B10; color: #EDE4D3;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 24px; box-sizing: border-box;
          }
          main { max-width: 420px; width: 100%; text-align: center; }
          h1 { font-size: 22px; letter-spacing: 1px; color: #F5A83C; margin: 0 0 12px; }
          p.sub { color: #8F97A3; margin: 0 0 28px; font-size: 14px; line-height: 1.5; }
          .code-card {
            background: #12141C; border: 1px solid #4A5A6B; border-radius: 12px;
            padding: 24px; margin-bottom: 24px;
          }
          .code-label { font-size: 11px; letter-spacing: 2px; color: #8F97A3; margin-bottom: 8px; }
          .code { font-size: 36px; font-weight: 700; color: #D97F1F; letter-spacing: 4px; }
          .cta {
            display: inline-block; background: #D97F1F; color: #0A0B10; font-weight: 700;
            text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 15px;
          }
          .fallback { margin-top: 16px; font-size: 13px; color: #8F97A3; }
          .loading, .invalid { color: #8F97A3; font-size: 14px; }
        </style>
        </head>
        <body>
        <main id="content">
          <p class="loading">Reading the thread…</p>
        </main>
        <script>
          var params = new URLSearchParams(window.location.search);
          var code = (params.get('code') || '').trim();
          var content = document.getElementById('content');

          function renderMissing() {
            content.innerHTML =
              '<h1>This Link Looks Incomplete</h1>' +
              '<p class="sub">The invite code is missing from this link. Ask the friend who sent it to share it again.</p>';
          }

          function renderInvalid() {
            content.innerHTML =
              '<h1>This Thread Has Faded</h1>' +
              '<p class="sub">This invitation is no longer active — it may have already been used or expired. Ask your friend to weave a new one.</p>';
          }

          function escapeHtml(value) {
            return String(value)
              .split('&').join('&amp;')
              .split('<').join('&lt;')
              .split('>').join('&gt;')
              .split('"').join('&quot;');
          }

          function renderValid(code) {
            content.innerHTML =
              '<h1>A Thread Has Been Woven</h1>' +
              '<p class="sub">A friend on MingldIngl thinks you two would hit it off. Open the app and enter this code to find out who.</p>' +
              '<div class="code-card"><div class="code-label">YOUR CODE</div><div class="code">' + escapeHtml(code) + '</div></div>' +
              '<a class="cta" href="mingldingl://">Open MingldIngl</a>' +
              '<p class="fallback">Don\'t have the app yet? Ask the friend who sent this, or check back soon.</p>';
          }

          if (!code) {
            renderMissing();
          } else {
            fetch('/public/ship-invite?code=' + encodeURIComponent(code))
              .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
              .then(function (d) { if (d.valid) renderValid(code); else renderInvalid(); })
              .catch(function () {
                content.innerHTML = '<p class="invalid">Couldn\'t check this invite right now — try again shortly.</p>';
              });
          }
        </script>
        </body>
        </html>
        """;
}
