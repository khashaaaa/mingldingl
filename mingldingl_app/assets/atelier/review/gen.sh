#!/bin/bash
# Candidate art for the review sheet. Each line: name | aspect | prompt
cd /home/khashaa/Desktop/mingldingl
EMB='Hand-painted digital art in the quality of Diablo IV and World of Warcraft achievement icons, painterly brushwork, not a photograph. Seen straight on, centered, filling 70 percent of the frame, isolated on a plain pure black background with nothing else. Warm key light from the top left, deep shadows, small bright gold glints and a soft warm glow. No text, no letters, no numbers, no border, no frame.'
SCN='Hand-painted digital illustration, dark fantasy RPG game art in the quality of Darkest Dungeon and Diablo IV concept paintings, painterly visible brush strokes, stylized, flat painted planes and soft gradients, not a photograph, not 3D render. Night-blue shadows, warm firelight and rich gold accents, moody and mysterious. No text, no letters, no writing, no border, no frame, no watermark. The subject is centered and isolated on a plain pure black background with nothing else, soft glow fading into black.'
GOLD='A single round hammered gold leaf medallion, thick hammered edge with a fine beaded rim, a raised relief motif in the centre:'
run() { # name aspect prompt
  echo "== $1"; zapdigga gen "$3" -n 4 -s "$2" -o "mingldingl_app/assets/atelier/review/$1" 2>&1 | tail -5
}
run honour_naadam_bow 1:1 "$GOLD a drawn recurve bow with a nocked arrow. $EMB"
run honour_naadam_flags 1:1 "$GOLD three small pennant flags on one rope above a horizon line. $EMB"
run honour_cartographer 1:1 "$GOLD a compass rose above a winding road that passes three small flags. $EMB"
run ally_horn 1:1 "A curved ox horn war horn with brass bands and a leather carrying strap, hanging on a dark stone wall. $SCN"
run rite_bowl_low 1:1 "A shallow black cast iron bowl on three short legs, the fire burned down to a few dim red embers and a thin wisp of smoke, no flame. Dark iron, not brass, not gold. $SCN"
run naadam_pennants 16:9 "A rope strung across the whole width with a row of small triangular pennant flags in red, blue and gold fluttering in the wind, seen close, night sky behind. $SCN"
run fest_blossoms 16:9 "A branch of pale pink spring blossoms stretching across the whole width, petals drifting off into the air, soft and light. $SCN"
for g in "garnet, deep red" "opal, milky white with rainbow fire" "amethyst, violet" "sapphire, deep blue" "ruby, bright red" "emerald, green"; do
  n=${g%%,*}
  run gem_$n 1:1 "A single large cut $g gemstone with glowing painted facets, set in a dark forged iron bezel with four small gold claws, the gem is the only thing that shines. $SCN"
done
echo ALLDONE
