using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("reports")]
[Authorize]
[Produces("application/json")]
public class ReportsController : ControllerBase
{
    private readonly ReportService _reports;

    public ReportsController(ReportService reports) => _reports = reports;

    /// <summary>
    /// Reports another user. Reachable from anywhere the reported person can be seen — a chat, a
    /// Town Square round, a profile — because the people worth reporting are not only the ones you
    /// already matched with. Filing one also blocks them and ends any live conversation.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CreateReportResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateReportRequest req)
    {
        var report = await _reports.CreateAsync(
            this.CurrentUserId(), req.ReportedUserId, req.Reason, req.Details, req.MatchId);
        return Ok(new CreateReportResponse(report.Id, report.Status));
    }
}

public record CreateReportRequest(
    [Required] Guid ReportedUserId,
    [Required, MaxLength(FieldLimits.ShortLabel)] string Reason,
    [MaxLength(FieldLimits.Reason)] string? Details,
    Guid? MatchId);

public record CreateReportResponse(Guid Id, string Status);
