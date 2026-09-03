namespace MinglDingl.Engine.Tests.Integration;

// Tests that run table-wide statements against the shared local Postgres
// (RecomputeAllGemTiersAsync updates every mismatched Users row) deadlock
// against the row locks other test classes hold inside their own
// transactions. xUnit runs a parallel-disabled collection on its own,
// after the parallel ones, so these get the table to themselves.
[CollectionDefinition(Name, DisableParallelization = true)]
public class SerialCollection
{
    public const string Name = "Serial";
}
