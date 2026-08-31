namespace MinglDingl.Engine.Tests.Services;

public class MongoliaGeoTests
{
    [Fact]
    public void DistanceKm_SamePoint_IsZero()
    {
        Assert.Equal(0, MongoliaGeo.DistanceKm(47.9184, 106.9153, 47.9184, 106.9153), 9);
    }

    [Fact]
    public void DistanceKm_IsSymmetric()
    {
        var ab = MongoliaGeo.DistanceKm(47.9184, 106.9153, 49.4867, 105.9228);
        var ba = MongoliaGeo.DistanceKm(49.4867, 105.9228, 47.9184, 106.9153);
        Assert.Equal(ab, ba, 9);
    }

    [Fact]
    public void DistanceKm_UlaanbaatarToDarkhan_IsRoughly190Km()
    {
        var km = MongoliaGeo.DistanceKm(47.9184, 106.9153, 49.4867, 105.9228);
        Assert.InRange(km, 180, 200);
    }

    [Fact]
    public void NearestCity_ExactCityCoordinates_ReturnsThatCity()
    {
        foreach (var city in MongoliaGeo.Cities)
            Assert.Equal(city.Name, MongoliaGeo.NearestCity(city.Latitude, city.Longitude));
    }

    [Fact]
    public void NearestCity_PointNearErdenet_ReturnsErdenet()
    {
        Assert.Equal("Erdenet", MongoliaGeo.NearestCity(49.05, 104.10));
    }

    [Fact]
    public void Cities_IsUnionOfProvincesAndDistricts_WithUniqueNames()
    {
        Assert.Equal(MongoliaGeo.Provinces.Count + MongoliaGeo.UlaanbaatarDistricts.Count, MongoliaGeo.Cities.Count);
        Assert.Equal(MongoliaGeo.Cities.Count, MongoliaGeo.Cities.Select(c => c.Name).Distinct().Count());
    }

    [Theory]
    [InlineData(0, 0, true)]
    [InlineData(90, 180, true)]
    [InlineData(-90, -180, true)]
    [InlineData(90.0001, 0, false)]
    [InlineData(-90.0001, 0, false)]
    [InlineData(0, 180.0001, false)]
    [InlineData(0, -180.0001, false)]
    public void IsValidCoordinate_ChecksInclusiveBounds(double lat, double lon, bool expected)
    {
        Assert.Equal(expected, MongoliaGeo.IsValidCoordinate(lat, lon));
    }
}
