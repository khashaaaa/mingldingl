"""Code-painted icon pieces: forged/molten glyphs, shields, wax. Height map + one light."""
import math, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi
N=1024
FONTS={"pirata":"/home/khashaa/Desktop/mingldingl/mingldingl_app/node_modules/@expo-google-fonts/pirata-one/400Regular/PirataOne_400Regular.ttf",
       "yeseva":"/home/khashaa/Desktop/mingldingl/mingldingl_app/node_modules/@expo-google-fonts/yeseva-one/400Regular/YesevaOne_400Regular.ttf"}
L=np.array([-0.45,-0.65,0.62]); L/=np.linalg.norm(L); Hh=L+np.array([0,0,1.]); Hh/=np.linalg.norm(Hh)
rng=np.random.default_rng(5)
def noise(scale, seed=0):
    r=np.random.default_rng(seed); n=r.standard_normal((N//scale+2,N//scale+2))
    return ndi.zoom(n, scale, order=3)[:N,:N]
def fbm(scales, seed=0):
    o=sum(noise(s,seed+i)/ (i+1) for i,s in enumerate(scales)); return o/np.abs(o).max()
def mix(a,b,t): a=np.asarray(a,float); b=np.asarray(b,float); t=np.asarray(t,float)[...,None]; return a*(1-t)+b*t
def ramp(t, stops):
    stops=np.asarray(stops,float); out=np.zeros(t.shape+(3,))
    for c in range(3): out[...,c]=np.interp(t,stops[:,0],stops[:,c+1])
    return out
def glyph(ch, font, size, dy=0):
    im=Image.new("L",(N,N),0); d=ImageDraw.Draw(im); f=ImageFont.truetype(FONTS[font],size)
    b=d.textbbox((0,0),ch,font=f); w,h=b[2]-b[0],b[3]-b[1]
    d.text(((N-w)/2-b[0],(N-h)/2-b[1]+dy),ch,font=f,fill=255)
    return np.asarray(im).astype(float)/255
def bevel_height(mask, bevel=26, hammer=0.0, seed=1):
    m=mask>0.5; dist=ndi.distance_transform_edt(m)
    h=np.clip(dist/bevel,0,1); h=np.sin(h*math.pi/2)  # rounded shoulder
    if hammer: h=h+hammer*fbm([22,9],seed)*np.clip(dist/bevel,0,1)
    return ndi.gaussian_filter(h,1.0)*bevel, dist
def normals(h, relief=1.0):
    gy,gx=np.gradient(h); n=np.dstack([-gx*relief,-gy*relief,np.ones_like(h)]); return n/np.linalg.norm(n,axis=2,keepdims=True)
GOLD=[(0,40,24,6),(0.35,143,100,16),(0.6,217,162,27),(0.82,245,197,66),(1,251,230,166)]
BRASS=[(0,34,24,10),(0.4,104,74,30),(0.7,160,122,60),(1,222,190,128)]
IRON=[(0,14,12,14),(0.5,46,42,44),(1,110,104,100)]
def shade_metal(h, pal, spec=60, env=0.35, relief=1.0):
    n=normals(h,relief); d=np.clip(n@L,0,1); s=np.clip(n@Hh,0,1)**spec
    # fake environment: normals facing up catch the warm fire glow from below? no — top sky dark, bottom ember
    envt=np.clip(0.5-n[...,1]*0.5,0,1)  # facing down -> 1
    col=ramp(np.clip(d*1.05,0,1),pal)
    col=col+env*envt[...,None]*np.array([90,40,10])*(1-d[...,None])
    col=mix(col,(255,244,214),np.clip(s*1.4,0,1))
    return np.clip(col,0,255)
def molten(dist, mask, seed=3, width=60):
    heat=np.clip(dist/width,0,1)**0.7
    heat=heat*(0.8+0.25*fbm([30,12],seed))
    cr=np.abs(fbm([40,14],seed+7))<0.06   # cooling cracks
    heat=np.where(cr, heat*0.35, heat)
    col=ramp(np.clip(heat,0,1),[(0,30,10,8),(0.25,110,24,10),(0.5,208,90,30),(0.75,245,170,50),(1,255,236,170)])
    return col, heat
def bg_floor(glow=(208,100,58), g=0.75, stars=50, embers=0, seed=2, ember_from_bottom=0.0):
    yy,xx=np.mgrid[0:N,0:N].astype(float)
    t=np.clip(1-np.hypot(xx-N/2,yy-N*0.45)/(N*0.8),0,1)
    col=mix((6,9,18),(15,20,36),t)
    c=np.clip(1-np.hypot(xx-N/2,yy-N/2)/(N*0.48),0,1)**2.2*g
    col=col+c[...,None]*np.asarray(glow)*0.55
    if ember_from_bottom:
        e=np.clip((yy/N-0.45)/0.55,0,1)**2*ember_from_bottom*(0.85+0.3*fbm([90,30],seed))
        col=col+e[...,None]*np.array([176,50,18])*0.8
    im=Image.fromarray(np.clip(col,0,255).astype(np.uint8)).convert("RGBA"); d=ImageDraw.Draw(im)
    r=np.random.default_rng(seed)
    for _ in range(stars):
        x,y=r.integers(0,N,2)
        if math.hypot(x-N/2,y-N/2)<N*0.40: continue
        a=int(r.integers(60,170)); s=int(r.choice([1,1,2])); d.ellipse([x-s,y-s,x+s,y+s],fill=(a,a,int(a*.85),255))
    if embers:
        lay=Image.new("RGBA",(N,N),(0,0,0,0)); dl=ImageDraw.Draw(lay)
        for _ in range(embers):
            x=r.normal(N/2,N*0.28); y=N-abs(r.normal(0,N*0.35))
            s=float(r.choice([2,3,3,4,6])); a=int(r.integers(140,255))
            dl.ellipse([x-s,y-s,x+s,y+s],fill=(255,int(r.integers(120,200)),50,a))
        im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(1.6))); im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(7)))
    return im
def to_rgba(col, mask, soft=0.8):
    a=ndi.gaussian_filter(mask.astype(float),soft)
    return Image.fromarray(np.dstack([np.clip(col,0,255),np.clip(a,0,1)*255]).astype(np.uint8),"RGBA")
def drop_shadow(base, piece, off=18, blur=22, k=0.75):
    a=piece.split()[3].point(lambda v:int(v*k)); sh=Image.new("RGBA",(N,N),(0,0,0,0))
    sh.paste((0,0,0,255),(0,off),a); base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))
def outer_glow(base, mask, color=(255,140,40), r1=18, r2=60, k=0.9):
    m=Image.fromarray((np.clip(mask,0,1)*255).astype(np.uint8))
    for rad,kk in ((r1,k),(r2,k*0.7)):
        g=m.filter(ImageFilter.GaussianBlur(rad)); lay=Image.new("RGBA",(N,N),color+(0,)); lay.putalpha(g.point(lambda v:int(min(255,v*kk))))
        base.alpha_composite(lay)
def piece_img(path, size, dx=0, dy=0):
    c=Image.open(path).convert("RGBA"); c=c.crop(c.getbbox()); k=size/max(c.size)
    c=c.resize((round(c.width*k),round(c.height*k)),Image.LANCZOS); lay=Image.new("RGBA",(N,N),(0,0,0,0))
    lay.alpha_composite(c,((N-c.width)//2+dx,(N-c.height)//2+dy)); return lay
def shade_gold_rich(h, relief=1.4, seed=1):
    n=normals(h,relief); d=np.clip(n@L,0,1); s=np.clip(n@Hh,0,1)
    t=np.clip(d**1.6,0,1)
    col=ramp(t,[(0,30,16,4),(0.3,110,70,10),(0.55,190,134,24),(0.8,240,190,60),(1,255,236,170)])
    envt=np.clip(0.5-n[...,1]*0.6,0,1); col=col+envt[...,None]*np.array([120,45,10])*0.5*(1-t[...,None])
    col=mix(col,(255,248,225),np.clip(s**70*1.6+s**12*0.15,0,1))
    cav=np.clip(ndi.gaussian_filter(h,4)-h,0,None); cav/=cav.max()+1e-9
    col=mix(col,(30,16,4),np.clip(cav*0.9,0,0.7))
    return np.clip(col,0,255)
def facets(mask, cells=70, seed=4, pal=None, glow=(255,60,40)):
    r=np.random.default_rng(seed); m=mask>0.5
    ys,xs=np.nonzero(m); idx=r.choice(len(ys),cells,replace=False); pts=np.stack([ys[idx],xs[idx]],1)
    yy,xx=np.mgrid[0:N,0:N]
    from scipy.spatial import cKDTree
    lab=cKDTree(pts).query(np.stack([yy.ravel(),xx.ravel()],1))[1].reshape(N,N)
    nrm=r.normal(0,0.55,(cells,3)); nrm[:,2]=1; nrm/=np.linalg.norm(nrm,axis=1,keepdims=True)
    n=nrm[lab]; d=np.clip(n@L,0,1); s=np.clip(n@Hh,0,1)**30
    dist=ndi.distance_transform_edt(m); inner=np.clip(dist/60,0,1)
    pal=pal or [(0,40,2,10),(0.4,120,8,24),(0.7,210,30,40),(0.9,255,90,70),(1,255,200,170)]
    t=np.clip(d*0.8+inner*0.35*(0.5+0.5*np.sin(lab*1.7)),0,1)
    col=ramp(t,pal); col=mix(col,(255,240,235),np.clip(s*1.3,0,1))
    edges=(ndi.maximum_filter(lab,3)!=ndi.minimum_filter(lab,3))&m
    col=np.where(edges[...,None], col*0.75+np.array([255,150,140])*0.25, col)
    return col
def shield_mask(w=640, h=740, dy=10):
    im=Image.new("L",(N,N),0); d=ImageDraw.Draw(im); x0=(N-w)/2; y0=(N-h)/2+dy
    pts=[]
    for i in range(41):
        t=i/40; pts.append((x0+w*t, y0+ 18*math.sin(t*math.pi)*-1+ (0)))
    # sides down then curve to point
    for i in range(41):
        t=i/40; ang=t*math.pi/2
        pts.append((x0+w - (w/2)*(1-math.cos(ang))**1.0*1.0 , y0+h*0.45 + (h*0.55)*math.sin(ang)))
    for i in range(41):
        t=i/40; ang=(1-t)*math.pi/2
        pts.append((x0 + (w/2)*(1-math.cos(ang)), y0+h*0.45 + (h*0.55)*math.sin(ang)))
    pts=[(x0+w,y0)]+pts[41:82]+pts[82:]+[(x0,y0)]
    d.polygon([(x0,y0),(x0+w,y0)]+pts[1:41]+pts[41:],fill=255)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(0.8))).astype(float)/255
