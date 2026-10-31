# 十神試煉場 — 產生升階(t1–t4)提示詞清單,參考圖為各角色 t0 原圖
# 用法:python3 scripts/si-art/si_tiers.py <t0 原圖資料夾> <輸出 json> god:bi_jian demon:7 …
import json, os, sys

SI_KEEP = ("Keep exactly the same character identity, face, hairstyle, outfit design and chibi ink-wash style as the reference image; "
           "transparent background, full body, centered, no text, no red.")
SI_GOD_TIERS = [
    "Tier 2 upgrade: the item in hand becomes more refined and ornate, thin gold (#E3BE2B) trim added to the clothing.",
    "Tier 3 upgrade: a soft golden glow aura behind the character, embroidered robe details and a more formal flowing cape.",
    "Tier 4 upgrade: the item turns semi-spiritual with flowing ink ribbons around it, an elegant hair crown, feet slightly floating above ground.",
    "Tier 5 ultimate form: a golden halo disc behind the head, celestial flowing sashes, complete gold ornaments, majestic yet still cute chibi proportions.",
]
SI_DEMON_TIERS = {
    0: ["the two heads now biting each other", "the body split into a pure black half and a pale white half", "small horns and glowing yellow eyes", "three heads with a fiery gold outline around the body"],
    1: ["a stone block weighing on its back", "an even bigger head with fog covering the eyes", "a small dark crown on the huge head", "a gigantic head with a fiery gold outline"],
    2: ["short spikes on the shell", "many more spikes on the shell", "the shell turned into a shield wall in front", "fully sealed inside a dark cocoon with faint glowing cracks"],
    3: ["thin cracks across the shell", "frost and ice crystals on the body", "small icy horns", "a fully translucent ice shell with cold glow"],
    4: ["a pair of curved horns", "a burning flame mane along its back", "many more spines and a larger body", "the whole body wreathed in flames"],
    5: ["more mismatched eyes", "writhing tentacles", "several distorted faces in the lumps", "a huge towering mass of lumps and eyes"],
    6: ["wings spread open", "a feathered crest on the head", "black feathers swirling around it", "a giant two-winged raven form"],
    7: ["an even bigger grinning mouth", "several extra grabbing arms", "gold coins orbiting around it", "sitting on a mountain of gold coins"],
    8: ["two faint afterimage clones", "three afterimage clones", "four afterimage clones", "a swarm of distorted afterimages, violently trembling"],
    9: ["more trinkets and coins around it", "chains wrapped around the body", "a gold crown on its head", "enthroned on a throne made of piled objects"],
}


def si_build(ref_dir, keys):
    items = []
    for k in keys:
        if k.startswith("god:"):
            g = k[4:]
            for i, t in enumerate(SI_GOD_TIERS, 1):
                items.append({"file": f"si-god-{g}-t{i}.webp", "ref": os.path.join(ref_dir, f"si-god-{g}-t0.webp"),
                              "prompt": f"{t} {SI_KEEP}"})
        else:
            d = int(k.split(":")[1])  # demon:<序號>
            for i, t in enumerate(SI_DEMON_TIERS[d], 1):
                items.append({"file": f"si-demon-{d}-t{i}.webp", "ref": os.path.join(ref_dir, f"si-demon-{d}-t0.webp"),
                              "prompt": f"Tier {i + 1} stronger evolved form of this ink-shadow demon: {t}, slightly larger and more menacing. {SI_KEEP}"})
    return items


if __name__ == "__main__":
    json.dump(si_build(sys.argv[1], sys.argv[3:]), open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
