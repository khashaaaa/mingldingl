using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Encounters;

/// The icebreaker and Trial banks. Seeded at boot when a table is empty; the keepers' Codex edits
/// them later (stage 5). English only for now — the Mongolian comes from a native speaker.
public static class Questions
{
    public static readonly IReadOnlyList<string> Icebreakers =
    [
        "If you could walk anywhere in Mongolia tomorrow, where would you go — and why?",
        "What is a sound that means home to you?",
        "Which meal would you cook for someone you wanted to impress?",
        "What did you want to be when you were seven?",
        "What is the best advice an older person ever gave you?",
        "Where do you go when you need to think?",
        "Which season are you, and why?",
        "What small thing made you happy this week?",
        "What would you do with a free day and no one to answer to?",
        "Which song would you play at the start of a long drive?",
        "What is something you are quietly proud of?",
        "If you could learn one skill overnight, which would it be?",
        "What is the kindest thing a stranger has done for you?",
        "Which old story or legend do you still think about?",
        "What do you notice first when you walk into a room?",
        "Tea or coffee — and how do you take it?",
        "What would your friends say you are terrible at?",
        "Where in the world have you felt most free?",
        "What is a tradition from your family you would keep forever?",
        "What makes you laugh when nothing else can?",
    ];

    public sealed record Trial(string Text, string Topic, (string Choice, string Hint)[] Choices);

    public static readonly IReadOnlyList<Trial> Trials =
    [
        new("A free Saturday. You…", "how a free Saturday begins",
            [("Ride out early", "Horses, a river, no signal."), ("Find a quiet café", "A book and a long tea."),
             ("Gather friends", "A table full of noise and food."), ("Fix something", "A broken thing made whole by evening.")]),
        new("The perfect evening ends…", "how an evening should end",
            [("By the fire", "Talk until the coals go grey."), ("Under the stars", "Out past the city lights."),
             ("Early to bed", "Tomorrow starts at dawn."), ("Somewhere loud", "Music, and one more song.")]),
        new("A long journey. You would rather…", "how to travel",
            [("Plan every stop", "A map with every road marked."), ("Follow the road", "Turn where it looks good."),
             ("Go with a guide", "Someone who knows the way."), ("Stay home", "The best journeys are short ones.")]),
        new("When a friend is sad, you…", "how to comfort a friend",
            [("Listen", "Say little, stay long."), ("Make them laugh", "A joke to break the cloud."),
             ("Cook for them", "A warm bowl says it all."), ("Make a plan", "Fix what can be fixed.")]),
        new("Your home would be…", "what makes a home",
            [("A ger in the steppe", "Wide sky, few neighbours."), ("A flat in the city", "Everything a walk away."),
             ("A house by water", "A lake at the door."), ("Wherever family is", "Walls matter less than people.")]),
        new("A quarrel. You…", "how to settle a quarrel",
            [("Talk it out now", "No sleeping on anger."), ("Take a walk first", "Cool the iron, then speak."),
             ("Write it down", "Words chosen with care."), ("Let it pass", "Most storms blow over.")]),
        new("Morning or night?", "morning and night",
            [("First light", "Up before the sun."), ("Midday", "Neither early nor late."),
             ("Dusk", "The best hour of the day."), ("Deep night", "When the world is quiet.")]),
        new("A gift you would treasure…", "what a gift should be",
            [("Something handmade", "Hours in every stitch."), ("A shared day", "Time, not things."),
             ("A letter", "Words to keep."), ("Something useful", "A good knife, a warm coat.")]),
        new("With money to spare, you…", "what money is for",
            [("Save it", "For the hard winter."), ("Travel", "See what is over the hill."),
             ("Share it", "Family first."), ("Build something", "A business, a home, a future.")]),
        new("Tsagaan Sar morning. You are…", "how a holiday should feel",
            [("Visiting elders", "Every door, every greeting."), ("Cooking all night", "Buuz by the hundred."),
             ("Resting", "The year starts slow."), ("Out with friends", "The new year, loudly.")]),
        new("A day of rain. You…", "a day of rain",
            [("Stay in", "Blankets and a film."), ("Walk in it", "Rain never hurt anyone."),
             ("Clean the house", "A good day for order."), ("Call someone", "Long talk, slow tea.")]),
        new("What matters most in a partner?", "what matters most in a partner",
            [("Honesty", "Hard truths, kindly told."), ("Humour", "Laughter on the long road."),
             ("Steadiness", "Someone who shows up."), ("Curiosity", "Always another question.")]),
    ];

    public static async Task SeedAsync(AppDb db, CancellationToken ct = default)
    {
        if (!await db.Set<IcebreakerQuestion>().AnyAsync(ct))
            db.AddRange(Icebreakers.Select((t, i) => new IcebreakerQuestion { Id = i + 1, Text = t }));
        if (!await db.Set<TrialQuestion>().AnyAsync(ct))
            db.AddRange(Trials.Select((q, i) => new TrialQuestion
            {
                Id = i + 1, Text = q.Text, Topic = q.Topic,
                Choices = q.Choices.Select(c => c.Choice).ToArray(), Hints = q.Choices.Select(c => c.Hint).ToArray(),
            }));
        await db.SaveChangesAsync(ct);
    }
}
