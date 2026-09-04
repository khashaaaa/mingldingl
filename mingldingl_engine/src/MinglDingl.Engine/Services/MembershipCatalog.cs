/// <summary>
/// The membership tiers the app sells, priced from admin config so a price change is a Config
/// page edit rather than a deploy. The advertised daily-match perk reads the same budget keys
/// <see cref="ScoreService.DailyMatchBudget"/> enforces, so the card never promises a number
/// the ledger does not honour. Feature keys are product identity and stay in code.
/// </summary>
public class MembershipCatalog
{
    private readonly ConfigService _config;
    public MembershipCatalog(ConfigService config) => _config = config;

    public IReadOnlyList<MembershipTierResponse> Tiers()
    {
        int silver = Math.Max(1, (int)_config.GetNumber("membership.silver.monthly_mnt", 10900));
        int gold = Math.Max(1, (int)_config.GetNumber("membership.gold.monthly_mnt", 21900));
        var discounts = new Dictionary<int, double>
        {
            [1] = 0.0,
            [3] = Math.Clamp(_config.GetNumber("membership.discount.3mo_pct", 10), 0, 90) / 100.0,
            [6] = Math.Clamp(_config.GetNumber("membership.discount.6mo_pct", 20), 0, 90) / 100.0,
        };
        return
        [
            new("Free",   ScoreService.BaseBudgetFor(_config, "Free"),   false, null,   ["icebreakers_quizzes", "basic_profile"], []),
            new("Silver", ScoreService.BaseBudgetFor(_config, "Silver"), true,  silver, ["icebreakers_quizzes", "deep_profile_view"], MembershipPricing.PriceOptions(silver, discounts).ToArray()),
            new("Gold",   ScoreService.BaseBudgetFor(_config, "Gold"),   true,  gold,   ["icebreakers_quizzes", "deep_profile_view", "priority_matching"], MembershipPricing.PriceOptions(gold, discounts).ToArray()),
        ];
    }

    public MembershipTierResponse? Find(string level) => Tiers().FirstOrDefault(t => t.Level == level);
}
