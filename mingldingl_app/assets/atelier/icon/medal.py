import sys, numpy as np
from PIL import Image, ImageFilter
S=sys.argv[1]
src=Image.open(f"{S}/src/honour_first_bond.png").convert("RGBA")
src=src.crop(src.getbbox()).resize((1024,1024),Image.LANCZOS)
a=np.asarray(src).astype(np.float32)/255; rgb=a[...,:3]; al=a[...,3]
H,W=al.shape; yy,xx=np.mgrid[0:H,0:W]; r=np.hypot(xx-W/2,yy-H/2)/(W/2)
mx=rgb.max(-1); mn=rgb.min(-1); sat=(mx-mn)/(mx+1e-5)
R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]
# flames: warm (R>G>B), bright, saturated, inside the field
flame=((R>G*1.08)&(G>B*1.15)&(mx>0.42)&(sat>0.45)&(abs(xx-W/2)<W*0.17)&(abs(yy-H/2)<H*0.24)).astype(np.float32)
m=Image.fromarray((flame*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
fm=np.asarray(m).astype(np.float32)/255
lum=(0.3*R+0.59*G+0.11*B)
# field: darken + cool the medallion field a little so flames pop; warm the rim
field=np.clip((0.66-r)/0.06,0,1)
out=rgb*(1-0.30*field[...,None])
rim=np.clip((r-0.66)/0.05,0,1)*(r<1.0)
warm=np.stack([out[...,0]*1.10,out[...,1]*1.0,out[...,2]*0.85],-1)
out=out*(1-rim[...,None])+np.clip(warm,0,1)*rim[...,None]
# fire ramp by luminance: ember500 -> gold500 -> gold300 -> bone50
stops=np.array([[0.0,0x8c,0x30,0x16],[0.35,0xd0,0x64,0x3a],[0.6,0xd9,0xa2,0x1b],[0.82,0xf5,0xc5,0x42],[1.0,0xfb,0xf0,0xd0]],np.float32)
t=np.clip((lum-0.08)/0.50,0,1)**0.8
# brighter toward flame tips (top)
fire=np.zeros_like(rgb)
for c in range(3): fire[...,c]=np.interp(t,stops[:,0],stops[:,c+1]/255)
out=out*(1-fm[...,None])+fire*fm[...,None]
# glow: light spilled from the flames onto the field
g=Image.fromarray((fm*255).astype(np.uint8))
glow=(np.asarray(g.filter(ImageFilter.GaussianBlur(28))).astype(np.float32)/255*2.6
      +np.asarray(g.filter(ImageFilter.GaussianBlur(70))).astype(np.float32)/255*1.8)
glow=np.clip(glow,0,1)*np.clip((0.70-r)/0.05,0,1)*(1-fm)
gc=np.array([0.95,0.55,0.18],np.float32)
out=out*(1+glow[...,None]*np.array([0.9,0.35,-0.2],np.float32))+glow[...,None]*gc*0.42
res=np.dstack([np.clip(out,0,1),al])
Image.fromarray((res*255).astype(np.uint8)).save(f"{S}/src/medal_lit.png")
