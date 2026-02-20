import { Dimension, EntityDamageCause, EntityDieAfterEvent, EntityHurtAfterEvent, EntityRemoveBeforeEvent, EquipmentSlot, ItemReleaseUseAfterEvent, ItemStartUseAfterEvent, ItemStopUseAfterEvent, Player, Vector3 } from "@minecraft/server";
export function riptide({ source: player, itemStack }: ItemReleaseUseAfterEvent) {
    if (!itemStack || itemStack.typeId !== "minecraft:trident" || player.isOp() || !itemStack.getComponent("enchantable")?.hasEnchantment("minecraft:riptide")) return;
    player.lastRiptide = Date.now();
}
export function knockback({ hurtEntity, damageSource: { cause, damagingEntity } }: EntityHurtAfterEvent) {
    if (hurtEntity instanceof Player && [EntityDamageCause.entityAttack, EntityDamageCause.entityExplosion, EntityDamageCause.blockExplosion, EntityDamageCause.projectile].includes(cause)) {
        hurtEntity.lastKnockback = Date.now();
    }
    if (damagingEntity && damagingEntity instanceof Player) {
        const heldItem = damagingEntity.getComponent("equippable")?.getEquipment(EquipmentSlot.Mainhand);
        if (heldItem && heldItem.typeId === "minecraft:mace") {
            const windburst = heldItem.getComponent("enchantable")?.hasEnchantment("minecraft:wind_burst");
            if (windburst) {
                damagingEntity.lastKnockback = Date.now();
            }
        }
    }
}
export function itemStartUse({ source, itemStack }: ItemStartUseAfterEvent) {
    if (!itemStack || itemStack.typeId === "minecraft:fishing_rod") return;
    source.itemStartUse = Date.now();
}
export function itemStopUse({ source }: ItemStopUseAfterEvent) {
    source.invalidSprintStopUseAt = Date.now();
    delete source.itemStartUse;
}
function _applyKnockbackTimestamp(dimension: Dimension, location: Vector3, now: number) {
    const affectedPlayers = dimension.getEntities({
        location: location,
        maxDistance: 9,
        type: "minecraft:player",
    }) as Player[];
    affectedPlayers.forEach((player) => (player.lastKnockback = now));
}
export function entityRemove({ removedEntity }: EntityRemoveBeforeEvent) {
    if (removedEntity.typeId !== "minecraft:wind_charge_projectile") return;
    _applyKnockbackTimestamp(removedEntity.dimension, removedEntity.location, Date.now());
}
export function entityDie({ deadEntity }: EntityDieAfterEvent) {
    try {
        if (!deadEntity.getEffect("wind_charged")) return;
    } catch {
        return;
    }
    _applyKnockbackTimestamp(deadEntity.dimension, deadEntity.location, Date.now());
}
