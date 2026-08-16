using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// Stateless — doesn't touch _db at all, so it works during onboarding before
// the caller's User row exists yet. UsersController.UpdateLocation is the
// counterpart that actually persists a snapped city for an existing user.
[ApiController]
[Route("geo")]
[Authorize]
[Produces("application/json")]
public class GeoController : ControllerBase
{
    [HttpGet("nearest-city")]
    [ProducesResponseType(typeof(NearestCityResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public IActionResult GetNearestCity([FromQuery] double latitude, [FromQuery] double longitude)
    {
        if (!MongoliaGeo.IsValidCoordinate(latitude, longitude))
            return this.BadRequestError("Latitude/longitude out of range");

        return Ok(new NearestCityResponse(MongoliaGeo.NearestCity(latitude, longitude)));
    }

    // Names only, not coordinates — this backs the manual fallback picker
    // shown when location permission is denied, not a map. Split into
    // provinces vs. Ulaanbaatar's districts (rather than one flat list) so
    // the client can show Ulaanbaatar as a single top-level entry and only
    // reveal its districts once that's picked. Keeping the full
    // MongoliaGeo.Cities list server-side (rather than duplicating it in the
    // app) means it only ever needs updating in one place.
    [HttpGet("cities")]
    [ProducesResponseType(typeof(CitiesResponse), StatusCodes.Status200OK)]
    public IActionResult GetCities() =>
        Ok(new CitiesResponse(
            MongoliaGeo.Provinces.Select(c => c.Name).ToList(),
            MongoliaGeo.UlaanbaatarDistricts.Select(c => c.Name).ToList()));
}

public record NearestCityResponse(string City);

public record CitiesResponse(List<string> Provinces, List<string> UlaanbaatarDistricts);
