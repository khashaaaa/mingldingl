using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("users")]
[Authorize]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly ReferralService _referral;
    private readonly ShipService _ships;
    private readonly OathService _oaths;
    private readonly PhoneVerificationService _phones;
    private readonly LocalFileStorageService _storage;
    private readonly ConfigService _config;

    public UsersController(AppDbContext db, ScoreService score, ReferralService referral, ShipService ships, OathService oaths, PhoneVerificationService phones, LocalFileStorageService storage, ConfigService config)
    {
        _storage = storage;
        _config = config;
        _db = db;
        _score = score;
        _referral = referral;
        _ships = ships;
        _oaths = oaths;
        _phones = phones;
    }

    [HttpPost]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Upsert([FromBody] CreateUserRequest req)
    {
        var userId = this.CurrentUserId();
        var existing = await _db.Users.FindAsync(userId);

        // A new account requires a phone this engine verified via verify.mn. The JWT's phone claim
        // is set by the client and is not evidence of ownership, so it is never trusted here.
        var verifiedPhone = await _phones.GetVerifiedPhoneAsync(userId);
        if (existing is null && _phones.IsConfigured && verifiedPhone is null)
            return this.ForbiddenError("Phone number must be verified before creating an account", "phone.verification_required");

        var user = existing ?? new User { Id = userId };

        if (req.PreferredLocale is not null)
        {
            if (!PushCopy.IsSupportedLocale(req.PreferredLocale))
                return this.BadRequestError("PreferredLocale must be one of: en, mn", "profile.locale_invalid");
            user.PreferredLocale = req.PreferredLocale;
        }

        user.DisplayName = req.DisplayName;
        user.Age = req.Age;
        user.Gender = req.Gender;
        user.City = req.City;
        user.Bio = req.Bio;
        user.PhotoUrls = req.PhotoUrls;
        if (req.Latitude.HasValue) user.Latitude = req.Latitude;
        if (req.Longitude.HasValue) user.Longitude = req.Longitude;
        user.PhoneNumber ??= verifiedPhone ?? (_phones.IsConfigured ? null : this.CurrentPhoneNumber());

        var wasComplete = user.IsProfileComplete;
        user.IsProfileComplete = ScoreService.IsProfileComplete(user);

        if (existing is null) _db.Users.Add(user);
        else _db.Users.Update(user);
        await _db.SaveChangesAsync();

        DroppedItem? referralReward = null;
        if (user.IsProfileComplete && !wasComplete)
        {
            // Once ever, not once per transition: the flag flips back to false whenever a required
            // field is cleared, so paying on every rising edge let a profile be emptied and refilled
            // for +100 a round. The partial unique index is what actually settles it.
            await _score.TryAwardClaimedAsync(userId, "ProfileComplete", _score.Delta("ProfileComplete"));
            referralReward = await _referral.TryCompleteReferralAsync(userId, req.ReferralCode);
            await _ships.TryResolveInviteCodeAsync(userId, req.ReferralCode);
        }

        return Ok(ToResponse(user) with { ReferralRewardItem = referralReward });
    }

    [HttpGet("me")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMe()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        if (user.DeletionRequestedAt.HasValue && !user.IsDeleted)
        {
            user.DeletionRequestedAt = null;
            await _db.SaveChangesAsync();
        }

        await _referral.GetOrCreateCodeAsync(userId);
        var (held, needed) = await _oaths.GetProgressAsync(userId);
        return Ok(ToResponse(user) with { OathEncountersHeld = held, OathEncountersNeeded = needed });
    }

    [HttpPost("me/delete")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RequestDeletion()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        user.DeletionRequestedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToResponse(user));
    }

    [HttpPut("me")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update([FromBody] UpdateUserRequest req)
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        var droppedPhotos = new List<string>();

        if (req.DisplayName is not null) user.DisplayName = req.DisplayName;
        if (req.Bio is not null) user.Bio = req.Bio;
        if (req.PhotoUrls is not null)
        {
            // Files that are no longer referenced have to go — /uploads is public, so an orphaned
            // photo stays fetchable by anyone holding its URL long after the user removed it. The
            // unlink waits until the write has committed, or a later validation failure would
            // destroy the files while the row still points at them.
            droppedPhotos.AddRange(user.PhotoUrls.Except(req.PhotoUrls));
            user.PhotoUrls = req.PhotoUrls;
        }
        if (req.HasKids is not null) user.HasKids = req.HasKids;
        if (req.SmokingHabit is not null) user.SmokingHabit = req.SmokingHabit;
        if (req.DrinkingHabit is not null) user.DrinkingHabit = req.DrinkingHabit;
        if (req.Religion is not null) user.Religion = req.Religion;
        if (req.Lifestyle is not null) user.Lifestyle = req.Lifestyle;
        if (req.PushEnabled is not null) user.PushEnabled = req.PushEnabled.Value;
        if (req.AgeMin is not null) user.AgeMin = req.AgeMin.Value;
        if (req.AgeMax is not null) user.AgeMax = req.AgeMax.Value;
        if (req.IsPaused is not null) user.IsPaused = req.IsPaused.Value;
        if (req.PreferredLocale is not null)
        {
            if (!PushCopy.IsSupportedLocale(req.PreferredLocale))
                return this.BadRequestError("PreferredLocale must be one of: en, mn", "profile.locale_invalid");
            user.PreferredLocale = req.PreferredLocale;
        }
        if (req.City is not null)
        {
            user.City = req.City;
            user.Latitude = null;
            user.Longitude = null;
        }

        if (user.AgeMin > user.AgeMax)
            return this.BadRequestError("AgeMin cannot be greater than AgeMax", "profile.age_range_invalid");

        // This endpoint can empty a required field just as easily as fill one, so the derived flag
        // has to be recomputed here too — leaving it stale reported an emptied profile as complete.
        var wasComplete = user.IsProfileComplete;
        user.IsProfileComplete = ScoreService.IsProfileComplete(user);

        await _db.SaveChangesAsync();

        foreach (var dropped in droppedPhotos)
            _storage.DeleteByPublicUrl(dropped);

        if (user.IsProfileComplete && !wasComplete)
            await _score.TryAwardClaimedAsync(userId, "ProfileComplete", _score.Delta("ProfileComplete"));

        return Ok(ToResponse(user));
    }

    [HttpPost("me/location")]
    [ProducesResponseType(typeof(UpdateLocationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationRequest req)
    {
        if (!MongoliaGeo.IsValidCoordinate(req.Latitude, req.Longitude))
            return this.BadRequestError("Latitude/longitude out of range", "profile.location_invalid");

        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        user.Latitude = req.Latitude;
        user.Longitude = req.Longitude;
        user.City = MongoliaGeo.NearestCity(req.Latitude, req.Longitude);
        await _db.SaveChangesAsync();

        return Ok(new UpdateLocationResponse(user.City));
    }

    [HttpGet("me/items")]
    [ProducesResponseType(typeof(List<OwnedItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyItems()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");
        var owned = await _db.UserItems.AsNoTracking().Where(i => i.UserId == userId).ToListAsync();
        var result = owned
            .Select(i => (Row: i, Def: LootService.Catalog.FirstOrDefault(c => c.Id == i.ItemId)))
            .Where(x => x.Def is not null)
            .Select(x => new OwnedItemResponse(
                x.Def!.Id, x.Def.NameKey, x.Def.Rarity, x.Def.ItemType, x.Row.AcquiredAt,
                x.Def.Id == user.EquippedFrameId || x.Def.Id == user.EquippedTitleId))
            .OrderByDescending(r => r.AcquiredAt)
            .ToList();
        return Ok(result);
    }

    [HttpPost("me/items/{itemId}/equip")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> EquipItem(string itemId)
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");
        var def = LootService.Catalog.FirstOrDefault(c => c.Id == itemId);
        if (def is null) return this.NotFoundError("Unknown item", "item.unknown");
        bool owned = await _db.UserItems.AnyAsync(i => i.UserId == userId && i.ItemId == itemId);
        if (!owned) return this.NotFoundError("Item not in your trophies", "item.not_owned");

        switch (def.ItemType)
        {
            case "Frame": user.EquippedFrameId = user.EquippedFrameId == itemId ? null : itemId; break;
            case "Title": user.EquippedTitleId = user.EquippedTitleId == itemId ? null : itemId; break;
            default: return this.BadRequestError("Emblems are collection-only", "item.emblem_not_equippable");
        }
        await _db.SaveChangesAsync();
        return Ok(ToResponse(user));
    }

    [HttpGet("me/blocked")]
    [ProducesResponseType(typeof(List<BlockedUserResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBlockedUsers()
    {
        var userId = this.CurrentUserId();
        var blocks = await _db.BlockedUsers.AsNoTracking()
            .Where(b => b.BlockerId == userId)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();
        if (blocks.Count == 0) return Ok(new List<BlockedUserResponse>());

        var blockedIds = blocks.Select(b => b.BlockedId).ToList();
        var users = await _db.Users.AsNoTracking()
            .Where(u => blockedIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var result = blocks
            .Select(b =>
            {
                users.TryGetValue(b.BlockedId, out var u);
                return new BlockedUserResponse(
                    b.BlockedId,
                    u?.IsDeleted == true ? "" : u?.DisplayName ?? "",
                    u?.PhotoUrls.FirstOrDefault(),
                    b.CreatedAt);
            })
            .ToList();
        return Ok(result);
    }

    [HttpPost("me/blocked/{targetUserId}/unblock")]
    [ProducesResponseType(typeof(List<BlockedUserResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Unblock(Guid targetUserId)
    {
        var userId = this.CurrentUserId();
        var block = await _db.BlockedUsers
            .FirstOrDefaultAsync(b => b.BlockerId == userId && b.BlockedId == targetUserId);
        if (block is not null)
        {
            _db.BlockedUsers.Remove(block);
            await _db.SaveChangesAsync();
        }
        return await GetBlockedUsers();
    }

    [HttpPut("me/phone")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangePhone([FromBody] ChangePhoneRequest req)
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        if (!PhoneVerificationService.IsPhoneValid(req.PhoneNumber))
            return this.BadRequestError("Phone number must be 8 digits", "phone.invalid_format");

        bool taken = await _db.Users.AnyAsync(u => u.Id != userId && u.PhoneNumber == req.PhoneNumber);
        if (taken) return this.BadRequestError("This phone number is already registered", "phone.already_registered");

        if (_phones.IsConfigured)
        {
            if (req.VerificationId is not Guid verificationId)
                return this.BadRequestError("The new phone number must be verified first", "phone.new_not_verified");

            var claim = await _phones.ClaimAsync(verificationId, userId);
            if (claim != PhoneClaimResult.Ok)
                return this.BadRequestError("The new phone number must be verified first", "phone.new_not_verified");

            var proven = await _phones.GetVerifiedPhoneAsync(userId);
            if (proven != req.PhoneNumber)
                return this.BadRequestError("Verification does not match the requested number", "verification.number_mismatch");
        }

        user.PhoneNumber = req.PhoneNumber;
        await _db.SaveChangesAsync();
        return Ok(ToResponse(user));
    }

    [HttpPost("me/oath")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SwearOath([FromBody] SwearOathRequest req)
    {
        if (!OathService.ValidOaths.Contains(req.Oath))
            return this.BadRequestError("Oath must be one of Bond, Fate, Kinship", "oath.invalid");

        var user = await _oaths.SwearAsync(this.CurrentUserId(), req.Oath);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

        var (held, needed) = await _oaths.GetProgressAsync(user.Id);
        return Ok(ToResponse(user) with { OathEncountersHeld = held, OathEncountersNeeded = needed });
    }

    private UserResponse ToResponse(User u) => new(
        u.Id, u.DisplayName, u.Age, u.Gender, u.City, u.Bio,
        u.PhotoUrls,
        u.MembershipLevel, u.IsProfileComplete,
        u.EquippedFrameId, u.EquippedTitleId,
        u.HasKids, u.SmokingHabit, u.DrinkingHabit, u.Religion, u.Lifestyle,
        u.PushEnabled, u.AgeMin, u.AgeMax, u.IsPaused, u.PhoneNumber,
        u.ReferralCode,
        Oath: u.Oath,
        OathProven: u.OathProven,
        DeletionGraceDays: (int)DailyMaintenanceBackgroundService.GracePeriodFor(_config).TotalDays,
        PreferredLocale: u.PreferredLocale);
}
