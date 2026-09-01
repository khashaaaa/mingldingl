using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
            return this.BadRequestError("Latitude/longitude out of range", "profile.location_invalid");

        return Ok(new NearestCityResponse(MongoliaGeo.NearestCity(latitude, longitude)));
    }

    [HttpGet("cities")]
    [ProducesResponseType(typeof(CitiesResponse), StatusCodes.Status200OK)]
    public IActionResult GetCities() =>
        Ok(new CitiesResponse(
            MongoliaGeo.Provinces.Select(c => c.Name).ToList(),
            MongoliaGeo.UlaanbaatarDistricts.Select(c => c.Name).ToList()));
}

public record NearestCityResponse(string City);

public record CitiesResponse(List<string> Provinces, List<string> UlaanbaatarDistricts);
