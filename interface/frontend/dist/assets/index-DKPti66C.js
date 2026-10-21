import{c as ct,g as xh}from"./index-QOBDFL2j.js";function Sh(V,ie){for(var se=0;se<ie.length;se++){const Z=ie[se];if(typeof Z!="string"&&!Array.isArray(Z)){for(const ue in Z)if(ue!=="default"&&!(ue in V)){const he=Object.getOwnPropertyDescriptor(Z,ue);he&&Object.defineProperty(V,ue,he.get?he:{enumerable:!0,get:()=>Z[ue]})}}}return Object.freeze(Object.defineProperty(V,Symbol.toStringTag,{value:"Module"}))}var _s={},Ea={};Object.defineProperty(Ea,"__esModule",{value:!0});Ea.baseAssetPath=void 0;const Th=typeof window<"u"&&typeof window.document<"u",uc=Th?window.document.currentScript:null;let fc="/";uc&&(fc=uc.src.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^/]+$/,"/"));Ea.baseAssetPath=fc;var Ei={};Object.defineProperty(Ei,"__esModule",{value:!0});Ei.defaultModelFetcher=void 0;const Eh=V=>fetch(V).then(ie=>ie.arrayBuffer());Ei.defaultModelFetcher=Eh;var rr={},br={};Object.defineProperty(br,"__esModule",{value:!0});br.log=void 0;const ys=V=>ie=>{console.log(`VAD | ${V} >`,ie)};br.log={error:ys("error"),debug:ys("debug"),warn:ys("warn")};var oi={};Object.defineProperty(oi,"__esModule",{value:!0});oi.Message=void 0;var lc;(function(V){V.AudioFrame="AUDIO_FRAME",V.SpeechStart="SPEECH_START",V.VADMisfire="VAD_MISFIRE",V.SpeechEnd="SPEECH_END",V.SpeechStop="SPEECH_STOP",V.SpeechRealStart="SPEECH_REAL_START",V.FrameProcessed="FRAME_PROCESSED"})(lc||(oi.Message=lc={}));Object.defineProperty(rr,"__esModule",{value:!0});rr.FrameProcessor=rr.validateOptions=rr.defaultFrameProcessorOptions=void 0;const Sa=br,si=oi;rr.defaultFrameProcessorOptions={positiveSpeechThreshold:.3,negativeSpeechThreshold:.25,preSpeechPadMs:800,redemptionMs:1400,minSpeechMs:400,submitUserSpeechOnPause:!1};function kh(V){(V.positiveSpeechThreshold<0||V.positiveSpeechThreshold>1)&&Sa.log.error("positiveSpeechThreshold should be a number between 0 and 1"),(V.negativeSpeechThreshold<0||V.negativeSpeechThreshold>V.positiveSpeechThreshold)&&Sa.log.error("negativeSpeechThreshold should be between 0 and positiveSpeechThreshold"),V.preSpeechPadMs<0&&Sa.log.error("preSpeechPadMs should be positive"),V.redemptionMs<0&&Sa.log.error("redemptionMs should be positive"),V.minSpeechMs<0&&Sa.log.error("minSpeechMs should be positive")}rr.validateOptions=kh;const dc=V=>{const ie=V.reduce((Z,ue)=>(Z.push(Z.at(-1)+ue.length),Z),[0]),se=new Float32Array(ie.at(-1));return V.forEach((Z,ue)=>{const he=ie[ue];se.set(Z,he)}),se};function pc(V,ie){const se=Math.floor(V.redemptionMs/ie),Z=Math.floor(V.preSpeechPadMs/ie),ue=Math.floor(V.minSpeechMs/ie);return{redemptionFrames:se,preSpeechPadFrames:Z,minSpeechFrames:ue}}class Ih{constructor(ie,se,Z,ue){this.modelProcessFunc=ie,this.modelResetFunc=se,this.options=Z,this.msPerFrame=ue,this.speaking=!1,this.redemptionCounter=0,this.speechFrameCount=0,this.active=!1,this.speechRealStartFired=!1,this.setOptions=z=>{this.options={...this.options,...z};const{redemptionFrames:_e,preSpeechPadFrames:We,minSpeechFrames:je}=pc(this.options,this.msPerFrame);this.redemptionFrames=_e,this.preSpeechPadFrames=We,this.minSpeechFrames=je},this.reset=()=>{this.speaking=!1,this.speechRealStartFired=!1,this.audioBuffer=[],this.modelResetFunc(),this.redemptionCounter=0,this.speechFrameCount=0},this.pause=z=>{this.active=!1,this.options.submitUserSpeechOnPause?this.endSegment(z):this.reset()},this.resume=()=>{this.active=!0},this.endSegment=z=>{const _e=this.audioBuffer;this.audioBuffer=[];const We=this.speaking;if(this.reset(),We)if(_e.reduce(($e,be)=>be.isSpeech?$e+1:$e,0)>=this.minSpeechFrames){const $e=dc(_e.map(be=>be.frame));z({msg:si.Message.SpeechEnd,audio:$e})}else z({msg:si.Message.VADMisfire});return{}},this.process=async(z,_e)=>{if(!this.active)return;const We=await this.modelProcessFunc(z),je=We.isSpeech>=this.options.positiveSpeechThreshold;if(_e({probs:We,msg:si.Message.FrameProcessed,frame:z}),this.audioBuffer.push({frame:z,isSpeech:je}),je&&(this.speechFrameCount++,this.redemptionCounter=0),je&&!this.speaking&&(this.speaking=!0,_e({msg:si.Message.SpeechStart})),this.speaking&&this.speechFrameCount===this.minSpeechFrames&&!this.speechRealStartFired&&(this.speechRealStartFired=!0,_e({msg:si.Message.SpeechRealStart})),We.isSpeech<this.options.negativeSpeechThreshold&&this.speaking&&++this.redemptionCounter>=this.redemptionFrames){this.redemptionCounter=0,this.speechFrameCount=0,this.speaking=!1,this.speechRealStartFired=!1;const $e=this.audioBuffer;if(this.audioBuffer=[],$e.reduce((we,Ne)=>Ne.isSpeech?we+1:we,0)>=this.minSpeechFrames){const we=dc($e.map(Ne=>Ne.frame));_e({msg:si.Message.SpeechEnd,audio:we})}else _e({msg:si.Message.VADMisfire})}if(!this.speaking){for(;this.audioBuffer.length>this.preSpeechPadFrames;)this.audioBuffer.shift();this.speechFrameCount=0}},this.audioBuffer=[];const{redemptionFrames:he,preSpeechPadFrames:fe,minSpeechFrames:ge}=pc(this.options,this.msPerFrame);this.redemptionFrames=he,this.preSpeechPadFrames=fe,this.minSpeechFrames=ge,this.reset()}}rr.FrameProcessor=Ih;var mc={};function Rt(V){throw new Error('Could not dynamically require "'+V+'". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.')}var gc={exports:{}};/*!
 * ONNX Runtime Web v1.30.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */(function(V,ie){var se=(()=>{var Z=Object.defineProperty,ue=Object.getOwnPropertyDescriptor,he=Object.getOwnPropertyNames,fe=Object.prototype.hasOwnProperty,ge=(e=>typeof Rt<"u"?Rt:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof Rt<"u"?Rt:t)[r]}):e)(function(e){if(typeof Rt<"u")return Rt.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),z=(e,t,r)=>()=>{if(r)throw r[0];try{return e&&(t=e(e=0)),t}catch(i){throw r=[i],i}},_e=(e,t)=>{for(var r in t)Z(e,r,{get:t[r],enumerable:!0})},We=(e,t,r,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of he(t))!fe.call(e,a)&&a!==r&&Z(e,a,{get:()=>t[a],enumerable:!(i=ue(t,a))||i.enumerable});return e},je=e=>We(Z({},"__esModule",{value:!0}),e),$e,be,we,Ne,He,ut=z(()=>{"use strict";$e=new Map,be=[],we=(e,t,r)=>{if(t&&typeof t.init=="function"&&typeof t.createInferenceSessionHandler=="function"){let i=$e.get(e);if(i===void 0)$e.set(e,{backend:t,priority:r});else{if(i.priority>r)return;if(i.priority===r&&i.backend!==t)throw new Error(`cannot register backend "${e}" using priority ${r}`)}if(r>=0){let a=be.indexOf(e);a!==-1&&be.splice(a,1);for(let n=0;n<be.length;n++)if($e.get(be[n]).priority<=r){be.splice(n,0,e);return}be.push(e)}return}throw new TypeError("not a valid backend")},Ne=async e=>{let t=$e.get(e);if(!t)return"backend not found.";if(t.initialized)return t.backend;if(t.aborted)return t.error;{let r=!!t.initPromise;try{return r||(t.initPromise=t.backend.init(e)),await t.initPromise,t.initialized=!0,t.backend}catch(i){return r||(t.error=`${i}`,t.aborted=!0),t.error}finally{delete t.initPromise}}},He=async e=>{let t=e.executionProviders||[],r=t.map(u=>typeof u=="string"?u:u.name),i=r.length===0?be:r,a,n=[],s=new Set;for(let u of i){let l=await Ne(u);typeof l=="string"?n.push({name:u,err:l}):(a||(a=l),a===l&&s.add(u))}if(!a)throw new Error(`no available backend found. ERR: ${n.map(u=>`[${u.name}] ${u.err}`).join(", ")}`);for(let{name:u,err:l}of n)r.includes(u)&&console.warn(`removing requested execution provider "${u}" from session options because it is not available: ${l}`);let o=t.filter(u=>s.has(typeof u=="string"?u:u.name));return[a,new Proxy(e,{get:(u,l)=>l==="executionProviders"?o:Reflect.get(u,l)})]}}),Oe=z(()=>{"use strict";ut()}),xe,ve=z(()=>{"use strict";xe="1.30.0"}),Ae,de,Ve=z(()=>{"use strict";ve(),Ae="warning",de={wasm:{},webgl:{},webgpu:{},versions:{common:xe},set logLevel(e){if(e!==void 0){if(typeof e!="string"||["verbose","info","warning","error","fatal"].indexOf(e)===-1)throw new Error(`Unsupported logging level: ${e}`);Ae=e}},get logLevel(){return Ae}},Object.defineProperty(de,"logLevel",{enumerable:!0})}),te,et=z(()=>{"use strict";Ve(),te=de}),ht,Bt,zt=z(()=>{"use strict";ht=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);r.width=e.dims[3],r.height=e.dims[2];let i=r.getContext("2d");if(i!=null){let a,n;(t==null?void 0:t.tensorLayout)!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],n=e.dims[3]):(a=e.dims[3],n=e.dims[2]);let s=(t==null?void 0:t.format)!==void 0?t.format:"RGB",o=t==null?void 0:t.norm,u,l;o===void 0||o.mean===void 0?u=[255,255,255,255]:typeof o.mean=="number"?u=[o.mean,o.mean,o.mean,o.mean]:(u=[o.mean[0],o.mean[1],o.mean[2],0],o.mean[3]!==void 0&&(u[3]=o.mean[3])),o===void 0||o.bias===void 0?l=[0,0,0,0]:typeof o.bias=="number"?l=[o.bias,o.bias,o.bias,o.bias]:(l=[o.bias[0],o.bias[1],o.bias[2],0],o.bias[3]!==void 0&&(l[3]=o.bias[3]));let p=n*a,d=0,h=p,m=p*2,f=-1;s==="RGBA"?(d=0,h=p,m=p*2,f=p*3):s==="RGB"?(d=0,h=p,m=p*2):s==="RBG"&&(d=0,m=p,h=p*2);for(let _=0;_<n;_++)for(let b=0;b<a;b++){let w=(e.data[d++]-l[0])*u[0],y=(e.data[h++]-l[1])*u[1],x=(e.data[m++]-l[2])*u[2],S=f===-1?255:(e.data[f++]-l[3])*u[3];i.fillStyle="rgba("+w+","+y+","+x+","+S+")",i.fillRect(b,_,1,1)}if("toDataURL"in r)return r.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},Bt=(e,t)=>{let r=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),i;if(r!=null){let a,n,s;(t==null?void 0:t.tensorLayout)!==void 0&&t.tensorLayout==="NHWC"?(a=e.dims[2],n=e.dims[1],s=e.dims[3]):(a=e.dims[3],n=e.dims[2],s=e.dims[1]);let o=t!==void 0&&t.format!==void 0?t.format:"RGB",u=t==null?void 0:t.norm,l,p;u===void 0||u.mean===void 0?l=[255,255,255,255]:typeof u.mean=="number"?l=[u.mean,u.mean,u.mean,u.mean]:(l=[u.mean[0],u.mean[1],u.mean[2],255],u.mean[3]!==void 0&&(l[3]=u.mean[3])),u===void 0||u.bias===void 0?p=[0,0,0,0]:typeof u.bias=="number"?p=[u.bias,u.bias,u.bias,u.bias]:(p=[u.bias[0],u.bias[1],u.bias[2],0],u.bias[3]!==void 0&&(p[3]=u.bias[3]));let d=n*a;if(t!==void 0&&(t.format!==void 0&&s===4&&t.format!=="RGBA"||s===3&&t.format!=="RGB"&&t.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let h=4,m=0,f=1,_=2,b=3,w=0,y=d,x=d*2,S=-1;o==="RGBA"?(w=0,y=d,x=d*2,S=d*3):o==="RGB"?(w=0,y=d,x=d*2):o==="RBG"&&(w=0,x=d,y=d*2),i=r.createImageData(a,n);for(let E=0;E<n*a;m+=h,f+=h,_+=h,b+=h,E++)i.data[m]=(e.data[w++]-p[0])*l[0],i.data[f]=(e.data[y++]-p[1])*l[1],i.data[_]=(e.data[x++]-p[2])*l[2],i.data[b]=S===-1?255:(e.data[S++]-p[3])*l[3]}else throw new Error("Can not access image data");return i}}),St,vr,xr,Be,Ct,Sr,ui=z(()=>{"use strict";Er(),St=(e,t)=>{if(e===void 0)throw new Error("Image buffer must be defined");if(t.height===void 0||t.width===void 0)throw new Error("Image height and width must be defined");if(t.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:r,width:i}=t,a=t.norm??{mean:255,bias:0},n,s;typeof a.mean=="number"?n=[a.mean,a.mean,a.mean,a.mean]:n=[a.mean[0],a.mean[1],a.mean[2],a.mean[3]??255],typeof a.bias=="number"?s=[a.bias,a.bias,a.bias,a.bias]:s=[a.bias[0],a.bias[1],a.bias[2],a.bias[3]??0];let o=t.format!==void 0?t.format:"RGBA",u=t.tensorFormat!==void 0&&t.tensorFormat!==void 0?t.tensorFormat:"RGB",l=r*i,p=u==="RGBA"?new Float32Array(l*4):new Float32Array(l*3),d=4,h=0,m=1,f=2,_=3,b=0,w=l,y=l*2,x=-1;o==="RGB"&&(d=3,h=0,m=1,f=2,_=-1),u==="RGBA"?x=l*3:u==="RBG"?(b=0,y=l,w=l*2):u==="BGR"&&(y=0,w=l,b=l*2);for(let S=0;S<l;S++,h+=d,f+=d,m+=d,_+=d)p[b++]=(e[h]+s[0])/n[0],p[w++]=(e[m]+s[1])/n[1],p[y++]=(e[f]+s[2])/n[2],x!==-1&&_!==-1&&(p[x++]=(e[_]+s[3])/n[3]);return u==="RGBA"?new Me("float32",p,[1,4,r,i]):new Me("float32",p,[1,3,r,i])},vr=async(e,t)=>{let r=typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement,i=typeof ImageData<"u"&&e instanceof ImageData,a=typeof ImageBitmap<"u"&&e instanceof ImageBitmap,n=typeof e=="string",s,o=t??{},u=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},l=p=>typeof HTMLCanvasElement<"u"&&p instanceof HTMLCanvasElement||p instanceof OffscreenCanvas?p.getContext("2d"):null;if(r){let p=u();p.width=e.width,p.height=e.height;let d=l(p);if(d!=null){let h=e.height,m=e.width;if(t!==void 0&&t.resizedHeight!==void 0&&t.resizedWidth!==void 0&&(h=t.resizedHeight,m=t.resizedWidth),t!==void 0){if(o=t,t.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");o.tensorFormat="RGBA",o.height=h,o.width=m}else o.tensorFormat="RGBA",o.height=h,o.width=m;d.drawImage(e,0,0),s=d.getImageData(0,0,m,h).data}else throw new Error("Can not access image data")}else if(i){let p,d;if(t!==void 0&&t.resizedWidth!==void 0&&t.resizedHeight!==void 0?(p=t.resizedHeight,d=t.resizedWidth):(p=e.height,d=e.width),t!==void 0&&(o=t),o.format="RGBA",o.height=p,o.width=d,t!==void 0){let h=u();h.width=d,h.height=p;let m=l(h);if(m!=null)m.putImageData(e,0,0),s=m.getImageData(0,0,d,p).data;else throw new Error("Can not access image data")}else s=e.data}else if(a){if(t===void 0)throw new Error("Please provide image config with format for Imagebitmap");let p=u();p.width=e.width,p.height=e.height;let d=l(p);if(d!=null){let h=e.height,m=e.width;return d.drawImage(e,0,0,m,h),s=d.getImageData(0,0,m,h).data,o.height=h,o.width=m,St(s,o)}else throw new Error("Can not access image data")}else{if(n)return new Promise((p,d)=>{let h=u(),m=l(h);if(!e||!m)return d();let f=new Image;f.crossOrigin="Anonymous",f.src=e,f.onload=()=>{h.width=f.width,h.height=f.height,m.drawImage(f,0,0,h.width,h.height);let _=m.getImageData(0,0,h.width,h.height);o.height=h.height,o.width=h.width,p(St(_.data,o))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(s!==void 0)return St(s,o);throw new Error("Input data provided is not supported - aborted tensor creation")},xr=(e,t)=>{let{width:r,height:i,download:a,dispose:n}=t,s=[1,i,r,4];return new Me({location:"texture",type:"float32",texture:e,dims:s,download:a,dispose:n})},Be=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:n}=t;return new Me({location:"gpu-buffer",type:r??"float32",gpuBuffer:e,dims:i,download:a,dispose:n})},Ct=(e,t)=>{let{dataType:r,dims:i,download:a,dispose:n}=t;return new Me({location:"ml-tensor",type:r??"float32",mlTensor:e,dims:i,download:a,dispose:n})},Sr=(e,t,r)=>new Me({location:"cpu-pinned",type:e,data:t,dims:r??[t.length]})}),ft,Mt,Tr,ki,Qa=z(()=>{"use strict";ft=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),Mt=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),Tr=!1,ki=()=>{if(!Tr){Tr=!0;let e=typeof BigInt64Array<"u"&&BigInt64Array.from,t=typeof BigUint64Array<"u"&&BigUint64Array.from,r=globalThis.Float16Array,i=typeof r<"u"&&r.from;e&&(ft.set("int64",BigInt64Array),Mt.set(BigInt64Array,"int64")),t&&(ft.set("uint64",BigUint64Array),Mt.set(BigUint64Array,"uint64")),i?(ft.set("float16",r),Mt.set(r,"float16")):ft.set("float16",Uint16Array)}}}),Ii,zi,Xa=z(()=>{"use strict";Er(),Ii=e=>{let t=1;for(let r=0;r<e.length;r++){let i=e[r];if(typeof i!="number"||!Number.isSafeInteger(i))throw new TypeError(`dims[${r}] must be an integer, got: ${i}`);if(i<0)throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${i}`);t*=i}return t},zi=(e,t)=>{switch(e.location){case"cpu":return new Me(e.type,e.data,t);case"cpu-pinned":return new Me({location:"cpu-pinned",data:e.data,type:e.type,dims:t});case"texture":return new Me({location:"texture",texture:e.texture,type:e.type,dims:t});case"gpu-buffer":return new Me({location:"gpu-buffer",gpuBuffer:e.gpuBuffer,type:e.type,dims:t});case"ml-tensor":return new Me({location:"ml-tensor",mlTensor:e.mlTensor,type:e.type,dims:t});default:throw new Error(`tensorReshape: tensor location ${e.location} is not supported`)}}}),Me,Er=z(()=>{"use strict";zt(),ui(),Qa(),Xa(),Me=class{constructor(e,t,r){ki();let i,a;if(typeof e=="object"&&"location"in e)switch(this.dataLocation=e.location,i=e.type,a=e.dims,e.location){case"cpu-pinned":{let s=ft.get(i);if(!s)throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);if(!(e.data instanceof s))throw new TypeError(`buffer should be of type ${s.name}`);this.cpuData=e.data;break}case"texture":{if(i!=="float32")throw new TypeError(`unsupported type "${i}" to create tensor from texture`);this.gpuTextureData=e.texture,this.downloader=e.download,this.disposer=e.dispose;break}case"gpu-buffer":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);this.gpuBufferData=e.gpuBuffer,this.downloader=e.download,this.disposer=e.dispose;break}case"ml-tensor":{if(i!=="float32"&&i!=="float16"&&i!=="int32"&&i!=="int64"&&i!=="uint32"&&i!=="uint64"&&i!=="int8"&&i!=="uint8"&&i!=="bool"&&i!=="uint4"&&i!=="int4")throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);this.mlTensorData=e.mlTensor,this.downloader=e.download,this.disposer=e.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let s,o;if(typeof e=="string")if(i=e,o=r,e==="string"){if(!Array.isArray(t))throw new TypeError("A string tensor's data must be a string array.");s=t}else{let u=ft.get(e);if(u===void 0)throw new TypeError(`Unsupported tensor type: ${e}.`);if(Array.isArray(t)){if(e==="float16"&&u===Uint16Array||e==="uint4"||e==="int4")throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${u.name} as data.`);e==="uint64"||e==="int64"?s=u.from(t,BigInt):s=u.from(t)}else if(t instanceof u)s=t;else if(t instanceof Uint8ClampedArray)if(e==="uint8")s=Uint8Array.from(t);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(e==="float16"&&t instanceof Uint16Array&&u!==Uint16Array)s=new globalThis.Float16Array(t.buffer,t.byteOffset,t.length);else throw new TypeError(`A ${i} tensor's data must be type of ${u}`)}else if(o=t,Array.isArray(e)){if(e.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let u=typeof e[0];if(u==="string")i="string",s=e;else if(u==="boolean")i="bool",s=Uint8Array.from(e);else throw new TypeError(`Invalid element type of data array: ${u}.`)}else if(e instanceof Uint8ClampedArray)i="uint8",s=Uint8Array.from(e);else{let u=Mt.get(e.constructor);if(u===void 0)throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);i=u,s=e}if(o===void 0)o=[s.length];else if(!Array.isArray(o))throw new TypeError("A tensor's dims must be a number array");a=o,this.cpuData=s,this.dataLocation="cpu"}let n=Ii(a);if(this.cpuData&&n!==this.cpuData.length&&!((i==="uint4"||i==="int4")&&Math.ceil(n/2)===this.cpuData.length))throw new Error(`Tensor's size(${n}) does not match data length(${this.cpuData.length}).`);this.type=i,this.dims=a,this.size=n}static async fromImage(e,t){return vr(e,t)}static fromTexture(e,t){return xr(e,t)}static fromGpuBuffer(e,t){return Be(e,t)}static fromMLTensor(e,t){return Ct(e,t)}static fromPinnedBuffer(e,t,r){return Sr(e,t,r)}toDataURL(e){return ht(this,e)}toImageData(e){return Bt(this,e)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(e){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let t=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=t,e&&this.disposer&&(this.disposer(),this.disposer=void 0),t}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(e){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return zi(this,e)}}}),qe,Ci=z(()=>{"use strict";Er(),qe=Me}),Zt,kr,tt,Ye,lt,dt,Oi=z(()=>{"use strict";Ve(),Zt=(e,t)=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeStamp(`${e}::ORT::${t}`)},kr=(e,t)=>{var a;let r=((a=new Error().stack)==null?void 0:a.split(/\r\n|\r|\n/g))||[],i=!1;for(let n=0;n<r.length;n++){if(i&&!r[n].includes("TRACE_FUNC")){let s=`FUNC_${e}::${r[n].trim().split(" ")[1]}`;t&&(s+=`::${t}`),Zt("CPU",s);return}r[n].includes("TRACE_FUNC")&&(i=!0)}},tt=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||kr("BEGIN",e)},Ye=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||kr("END",e)},lt=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.time(`ORT::${e}`)},dt=e=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeEnd(`ORT::${e}`)}}),Ai,Ya=z(()=>{"use strict";ut(),Ci(),Oi(),Ai=class yc{constructor(t){this.handler=t}async run(t,r,i){tt(),lt("InferenceSession.run");let a={},n={};if(typeof t!="object"||t===null||t instanceof qe||Array.isArray(t))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let s=!0;if(typeof r=="object"){if(r===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if(r instanceof qe)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray(r)){if(r.length===0)throw new TypeError("'fetches' cannot be an empty array.");s=!1;for(let l of r){if(typeof l!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(l)===-1)throw new RangeError(`'fetches' contains invalid output name: ${l}.`);a[l]=null}if(typeof i=="object"&&i!==null)n=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else{let l=!1,p=Object.getOwnPropertyNames(r);for(let d of this.outputNames)if(p.indexOf(d)!==-1){let h=r[d];(h===null||h instanceof qe)&&(l=!0,s=!1,a[d]=h)}if(l){if(typeof i=="object"&&i!==null)n=i;else if(typeof i<"u")throw new TypeError("'options' must be an object.")}else n=r}}else if(typeof r<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let l of this.inputNames)if(typeof t[l]>"u")throw new Error(`input '${l}' is missing in 'feeds'.`);if(s)for(let l of this.outputNames)a[l]=null;let o=await this.handler.run(t,a,n),u={};for(let l in o)if(Object.hasOwnProperty.call(o,l)){let p=o[l];p instanceof qe?u[l]=p:u[l]=new qe(p.type,p.data,p.dims)}return dt("InferenceSession.run"),Ye(),u}async release(){return this.handler.dispose()}static async create(t,r,i,a){tt(),lt("InferenceSession.create");let n,s={};if(typeof t=="string"){if(n=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof Uint8Array){if(n=t,typeof r=="object"&&r!==null)s=r;else if(typeof r<"u")throw new TypeError("'options' must be an object.")}else if(t instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&t instanceof SharedArrayBuffer){let p=t,d=0,h=t.byteLength;if(typeof r=="object"&&r!==null)s=r;else if(typeof r=="number"){if(d=r,!Number.isSafeInteger(d))throw new RangeError("'byteOffset' must be an integer.");if(d<0||d>=p.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${p.byteLength}).`);if(h=t.byteLength-d,typeof i=="number"){if(h=i,!Number.isSafeInteger(h))throw new RangeError("'byteLength' must be an integer.");if(h<=0||d+h>p.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${p.byteLength-d}].`);if(typeof a=="object"&&a!==null)s=a;else if(typeof a<"u")throw new TypeError("'options' must be an object.")}else if(typeof i<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof r<"u")throw new TypeError("'options' must be an object.");n=new Uint8Array(p,d,h)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[o,u]=await He(s),l=await o.createInferenceSessionHandler(n,u);return dt("InferenceSession.create"),Ye(),new yc(l)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),Ir,Ja=z(()=>{"use strict";Ya(),Ir=Ai}),en=z(()=>{"use strict"}),tn=z(()=>{"use strict"}),rn=z(()=>{"use strict"}),an=z(()=>{"use strict"}),Ri={};_e(Ri,{InferenceSession:()=>Ir,TRACE:()=>Zt,TRACE_EVENT_BEGIN:()=>lt,TRACE_EVENT_END:()=>dt,TRACE_FUNC_BEGIN:()=>tt,TRACE_FUNC_END:()=>Ye,Tensor:()=>qe,env:()=>te,registerBackend:()=>we});var Je=z(()=>{"use strict";Oe(),et(),Ja(),Ci(),en(),tn(),Oi(),rn(),an()}),zr=z(()=>{"use strict"}),Bi={};_e(Bi,{default:()=>Mi});var Cr,Or,Mi,nn=z(()=>{"use strict";var e;Hp(),_t(),Dr(),Cr="ort-wasm-proxy-worker",Or=((e=globalThis.self)==null?void 0:e.name)===Cr,Or&&(self.onmessage=t=>{let{type:r,in:i}=t.data;try{switch(r){case"init-wasm":Nr(i.wasm).then(()=>{as(i).then(()=>{postMessage({type:r})},a=>{postMessage({type:r,err:a})})},a=>{postMessage({type:r,err:a})});break;case"init-ep":{let{epName:a,env:n}=i;ns(n,a).then(()=>{postMessage({type:r})},s=>{postMessage({type:r,err:s})});break}case"copy-from":{let{buffer:a}=i,n=qa(a);postMessage({type:r,out:n});break}case"create":{let{model:a,options:n}=i;os(a,n).then(s=>{postMessage({type:r,out:s})},s=>{postMessage({type:r,err:s})});break}case"release":us(i),postMessage({type:r});break;case"run":{let{sessionId:a,inputIndices:n,inputs:s,outputIndices:o,options:u}=i;ds(a,n,s,o,new Array(o.length).fill(null),u).then(l=>{l.some(p=>p[3]!=="cpu")?postMessage({type:r,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:r,out:l},cs([...s,...l]))},l=>{postMessage({type:r,err:l})});break}case"end-profiling":ps(i),postMessage({type:r});break;default:}}catch(a){postMessage({type:r,err:a})}}),Mi=Or?null:t=>new Worker(t??De,{type:"classic",name:Cr})}),Di,Pi,De,Ar,ir,Ui,Ni,Rr,Li,Br,Vi,Mr,Fi,Dr=z(()=>{"use strict";zr(),Di=typeof location>"u"?void 0:location.origin,Pi=()=>{var e,t;return typeof document<"u"?(e=document.currentScript)==null?void 0:e.src:typeof self<"u"?(t=self.location)==null?void 0:t.href:void 0},De=Pi(),Ar=()=>{if(De&&!De.startsWith("blob:"))return De.substring(0,De.lastIndexOf("/")+1)},ir=(e,t)=>{try{let r=t??De;return(r?new URL(e,r):new URL(e)).origin===Di}catch{return!1}},Ui=(e,t)=>{let r=t??De;try{return(r?new URL(e,r):new URL(e)).href}catch{return}},Ni=(e,t)=>`${t??"./"}${e}`,Rr=async e=>{let t=await(await fetch(e,{credentials:"same-origin"})).blob();return URL.createObjectURL(t)},Li=async e=>(await import(e)).default,Br=(nn(),je(Bi)).default,Vi=async()=>{if(!De)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(ir(De))return[void 0,Br()];let e=await Rr(De);return[e,Br(e)]},Mr=void 0,Fi=async(e,t,r,i)=>{let a=Mr&&!(e||t);if(a)if(De)a=ir(De)||i&&!r;else if(i&&!r)a=!0;else throw new Error("cannot determine the script source URL.");if(a)return[void 0,Mr];{let n="ort-wasm-simd-threaded.jsep.mjs",s=e??Ui(n,t),o=r&&s&&!ir(s,t),u=o?await Rr(s):s??Ni(n,t);return[o?u:void 0,await Li(u)]}}}),Pr,ar,Dt,Ur,qi,Gi,Wi,Nr,pe,_t=z(()=>{"use strict";Dr(),ar=!1,Dt=!1,Ur=!1,qi=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Gi=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Wi=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Nr=async e=>{if(ar)return Promise.resolve();if(Dt)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Ur)throw new Error("previous call to 'initializeWebAssembly()' failed.");Dt=!0;let t=e.initTimeout,r=e.numThreads;if(e.simd!==!1){if(e.simd==="relaxed"){if(!Wi())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Gi())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let i=qi();r>1&&!i&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+r+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),e.numThreads=r=1);let a=e.wasmPaths,n=typeof a=="string"?a:void 0,s=a==null?void 0:a.mjs,o=(s==null?void 0:s.href)??s,u=a==null?void 0:a.wasm,l=(u==null?void 0:u.href)??u,p=e.wasmBinary,[d,h]=await Fi(o,n,r>1,!!p||!!l),m=!1,f=[];if(t>0&&f.push(new Promise(_=>{setTimeout(()=>{m=!0,_()},t)})),f.push(new Promise((_,b)=>{let w={numThreads:r};if(p)w.wasmBinary=p,w.locateFile=y=>y;else if(l||n)w.locateFile=y=>l??n+y;else if(o&&o.indexOf("blob:")!==0)w.locateFile=y=>new URL(y,o).href;else if(d){let y=Ar();y&&(w.locateFile=x=>y+x)}h(w).then(y=>{Dt=!1,ar=!0,Pr=y,_(),d&&URL.revokeObjectURL(d)},y=>{Dt=!1,Ur=!0,b(y)})})),await Promise.race(f),m)throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`)},pe=()=>{if(ar&&Pr)return Pr;throw new Error("WebAssembly is not initialized yet.")}}),Ge,nr,ne,Lr=z(()=>{"use strict";_t(),Ge=(e,t)=>{let r=pe(),i=r.lengthBytesUTF8(e)+1,a=r._malloc(i);return r.stringToUTF8(e,a,i),t.push(a),a},nr=(e,t,r,i)=>{if(typeof e=="object"&&e!==null){if(r.has(e))throw new Error("Circular reference in options");r.add(e)}Object.entries(e).forEach(([a,n])=>{let s=t?t+a:a;if(typeof n=="object")nr(n,s+".",r,i);else if(typeof n=="string"||typeof n=="number")i(s,n.toString());else if(typeof n=="boolean")i(s,n?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof n}`)})},ne=e=>{let t=pe(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetLastError(a,a+i);let n=Number(t.getValue(a,i===4?"i32":"i64")),s=t.getValue(a+i,"*"),o=s?t.UTF8ToString(s):"";throw new Error(`${e} ERROR_CODE: ${n}, ERROR_MESSAGE: ${o}`)}finally{t.stackRestore(r)}}}),ji,sn=z(()=>{"use strict";_t(),Lr(),ji=e=>{let t=pe(),r=0,i=[],a=e||{};try{if((e==null?void 0:e.logSeverityLevel)===void 0)a.logSeverityLevel=2;else if(typeof e.logSeverityLevel!="number"||!Number.isInteger(e.logSeverityLevel)||e.logSeverityLevel<0||e.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);if((e==null?void 0:e.logVerbosityLevel)===void 0)a.logVerbosityLevel=0;else if(typeof e.logVerbosityLevel!="number"||!Number.isInteger(e.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);(e==null?void 0:e.terminate)===void 0&&(a.terminate=!1);let n=0;return(e==null?void 0:e.tag)!==void 0&&(n=Ge(e.tag,i)),r=t._OrtCreateRunOptions(a.logSeverityLevel,a.logVerbosityLevel,!!a.terminate,n),r===0&&ne("Can't create run options."),(e==null?void 0:e.extra)!==void 0&&nr(e.extra,"",new WeakSet,(s,o)=>{let u=Ge(s,i),l=Ge(o,i);t._OrtAddRunConfigEntry(r,u,l)!==0&&ne(`Can't set a run config entry: ${s} - ${o}.`)}),[r,i]}catch(n){throw r!==0&&t._OrtReleaseRunOptions(r),i.forEach(s=>t._free(s)),n}}}),Hi,Ki,Zi,mt,Qi,Xi,on=z(()=>{"use strict";_t(),Lr(),Hi=e=>{switch(e){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${e}`)}},Ki=e=>{switch(e){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${e}`)}},Zi=e=>{e.extra||(e.extra={}),e.extra.session||(e.extra.session={});let t=e.extra.session;t.use_ort_model_bytes_directly||(t.use_ort_model_bytes_directly="1"),e.executionProviders&&e.executionProviders.some(r=>(typeof r=="string"?r:r.name)==="webgpu")&&(e.enableMemPattern=!1)},mt=(e,t,r,i)=>{let a=Ge(t,i),n=Ge(r,i);pe()._OrtAddSessionConfigEntry(e,a,n)!==0&&ne(`Can't set a session config entry: ${t} - ${r}.`)},Qi=async(e,t,r)=>{let i=t.executionProviders;for(let a of i){let n=typeof a=="string"?a:a.name,s=[];switch(n){case"webnn":if(n="WEBNN",mt(e,"session.disable_quant_qdq","1",r),mt(e,"session.disable_qdq_constant_folding","1",r),typeof a!="string"){let d=a==null?void 0:a.deviceType;d&&mt(e,"deviceType",d,r)}break;case"webgpu":if(n="JS",typeof a!="string"){let d=a;if(d!=null&&d.preferredLayout){if(d.preferredLayout!=="NCHW"&&d.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${d.preferredLayout}`);mt(e,"preferredLayout",d.preferredLayout,r)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${n}`)}let o=Ge(n,r),u=s.length,l=0,p=0;if(u>0){l=pe()._malloc(u*pe().PTR_SIZE),r.push(l),p=pe()._malloc(u*pe().PTR_SIZE),r.push(p);for(let d=0;d<u;d++)pe().setValue(l+d*pe().PTR_SIZE,s[d][0],"*"),pe().setValue(p+d*pe().PTR_SIZE,s[d][1],"*")}await pe()._OrtAppendExecutionProvider(e,o,l,p,u)!==0&&ne(`Can't append execution provider: ${n}.`)}},Xi=async e=>{let t=pe(),r=0,i=[],a=e||{};Zi(a);try{let n=Hi(a.graphOptimizationLevel??"all"),s=Ki(a.executionMode??"sequential"),o=typeof a.logId=="string"?Ge(a.logId,i):0,u=a.logSeverityLevel??2;if(!Number.isInteger(u)||u<0||u>4)throw new Error(`log severity level is not valid: ${u}`);let l=a.logVerbosityLevel??0;if(!Number.isInteger(l)||l<0||l>4)throw new Error(`log verbosity level is not valid: ${l}`);let p=typeof a.optimizedModelFilePath=="string"?Ge(a.optimizedModelFilePath,i):0;if(r=t._OrtCreateSessionOptions(n,!!a.enableCpuMemArena,!!a.enableMemPattern,s,!!a.enableProfiling,0,o,u,l,p),r===0&&ne("Can't create session options."),a.executionProviders&&await Qi(r,a,i),a.enableGraphCapture!==void 0){if(typeof a.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${a.enableGraphCapture}`);mt(r,"enableGraphCapture",a.enableGraphCapture.toString(),i)}if(a.freeDimensionOverrides)for(let[d,h]of Object.entries(a.freeDimensionOverrides)){if(typeof d!="string")throw new Error(`free dimension override name must be a string: ${d}`);if(typeof h!="number"||!Number.isInteger(h)||h<0)throw new Error(`free dimension override value must be a non-negative integer: ${h}`);let m=Ge(d,i);t._OrtAddFreeDimensionOverride(r,m,h)!==0&&ne(`Can't set a free dimension override: ${d} - ${h}.`)}return a.extra!==void 0&&nr(a.extra,"",new WeakSet,(d,h)=>{mt(r,d,h,i)}),[r,i]}catch(n){throw r!==0&&t._OrtReleaseSessionOptions(r)!==0&&ne("Can't release session options."),i.forEach(s=>t._free(s)),n}}}),wt,$t,bt,Vr,Fr,qr,Gr,li,le=z(()=>{"use strict";wt=e=>{switch(e){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${e}`)}},$t=e=>{switch(e){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${e}`)}},bt=(e,t)=>{let r=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][e],i=typeof t=="number"?t:t.reduce((a,n)=>a*n,1);return r>0?Math.ceil(i*r):void 0},Vr=e=>{switch(e){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${e}`)}},Fr=e=>{switch(e){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${e}`)}},qr=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",Gr=e=>e==="float32"||e==="float16"||e==="int32"||e==="int64"||e==="uint32"||e==="uint64"||e==="int8"||e==="uint8"||e==="bool"||e==="uint4"||e==="int4",li=e=>{switch(e){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${e}`)}}}),Wr,Yi=z(()=>{"use strict";zr(),Wr=async e=>{if(typeof e=="string"){let t=await fetch(e);if(!t.ok)throw new Error(`failed to load external data file: ${e}`);let r=t.headers.get("Content-Length"),i=r?parseInt(r,10):0;if(i<1073741824)return new Uint8Array(await t.arrayBuffer());{if(!t.body)throw new Error(`failed to load external data file: ${e}, no response body.`);let a=t.body.getReader(),n;try{n=new ArrayBuffer(i)}catch(o){if(o instanceof RangeError){let u=Math.ceil(i/65536);n=new WebAssembly.Memory({initial:u,maximum:u}).buffer}else throw o}let s=0;for(;;){let{done:o,value:u}=await a.read();if(o)break;let l=u.byteLength;new Uint8Array(n,s,l).set(u),s+=l}return new Uint8Array(n,0,i)}}else return e instanceof Blob?new Uint8Array(await e.arrayBuffer()):e instanceof Uint8Array?e:new Uint8Array(e)}}),Ji,di,pi,Qt,ci,hi,Se,Tt=z(()=>{"use strict";le(),Ji=["V","I","W","E","F"],di=(e,t)=>{console.log(`[${Ji[e]},${new Date().toISOString()}]${t}`)},ci=(e,t)=>{pi=e,Qt=t},hi=(e,t)=>{let r=Fr(e),i=Fr(pi);r>=i&&di(r,typeof t=="function"?t():t)},Se=(...e)=>{Qt&&hi(...e)}}),fi,Xt,M,pr,mi,ea,Pt,re=z(()=>{"use strict";fi=class{static calcMatMulShape(e,t){return e[1]!==t[0]?void 0:[e[0],t[1]]}},Xt=class{static calcShape(e,t,r=!1){let i=e.length,a=t.length;if(i===0)return t;if(a===0)return e;let n=Math.max(e.length,t.length),s=new Array(n);if(r){if(i<2||a<2)return;let o=fi.calcMatMulShape([e[i-2],e[i-1]],[t[a-2],t[a-1]]);if(o===void 0)return;[s[n-2],s[n-1]]=o}for(let o=r?3:1;o<=n;o++){let u=i-o<0?1:e[i-o],l=a-o<0?1:t[a-o];if(u!==l&&u>1&&l>1)return;let p=Math.max(u,l);if(u&&l)s[n-o]=Math.max(u,l);else{if(p>1)return;s[n-o]=0}}return s}static isValidBroadcast(e,t){let r=e.length,i=t.length;if(r>i)return!1;for(let a=1;a<=r;a++)if(e[r-a]!==1&&e[r-a]!==t[i-a])return!1;return!0}},M=class Ha{static size(t){return Ha.getSizeFromDimensionRange(t,0,t.length)}static convertShape(t,r=4){let i=t.length;if(i===0)return[];let a=new Array(i),n=i-1;for(;n>=0;){if(t[n]%r===0){a[n]=t[n]/r;break}if(r%t[n]!==0)throw new Error("cannot convert shape");a[n]=1,r/=t[n],n--}for(n--;n>=0;n--)a[n]=t[n];return a}static sizeFromDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${t.length} dimensions.`);return Ha.getSizeFromDimensionRange(t,r,t.length)}static sizeToDimension(t,r){if(r<0||r>t.length)throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${t.length} dimensions.`);return Ha.getSizeFromDimensionRange(t,0,r)}static getSizeFromDimensionRange(t,r,i){let a=1;for(let n=r;n<i;n++){if(t[n]<0)throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");a*=Number(t[n])}return a}static computeStrides(t){let r=t.length;if(r===0)return[];if(r===1)return[1];let i=new Array(r);i[r-1]=1,i[r-2]=t[r-1];for(let a=r-3;a>=0;--a)i[a]=i[a+1]*t[a+1];return i}static normalizeAxis(t,r){if(t<-r&&t>=r)throw new Error("unsupported axis for this operation.");return t<0?t+r:t}static normalizeAxes(t,r){return t.map(i=>this.normalizeAxis(i,r??t.length))}static sortBasedOnPerm(t,r){return r?r.map(i=>t[i]):t.slice().reverse()}static padShape(t,r){let i=t.length;return t.map((a,n)=>a+r[n]+r[n+i])}static areEqual(t,r){return t.length!==r.length?!1:t.every((i,a)=>i===r[a])}},pr=class $r{static adjustPoolAttributes(t,r,i,a,n,s){if(!t&&i.length!==r.length-2)throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(t)for(let o=0;o<r.length-2;o++)o>=i.length?i.push(r[o+2]):i[o]=r[o+2];for(let o=0;o<i.length;o++)if(o<a.length){if(a[o]<0)throw new Error("strides should be greater than or equal to 1")}else a.push(1);for(let o=0;o<i.length;o++)if(o<n.length){if(n[o]<0)throw new Error("dilations should be greater than or equal to 1")}else n.push(1);for(let o=0;o<i.length*2;o++)if(o<s.length){if(s[o]<0)throw new Error("pad should be greater than or equal to 1")}else s.push(0);for(let o=0;o<i.length;o++){if(i[o]<=0)throw new Error("kernel shapes need to be greater than 0");if(s[o]>=i[o]||s[o+i.length]>=i[o])throw new Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(t,r,i,a,n,s,o){if(o){if(n.length!==2*(t.length-2))throw new Error("length of pads should be twice the length of data dimensions");if(r.length!==t.length-2)throw new Error("length of strides should be the length of data dimensions");if(a.length!==t.length-2)throw new Error("length of kernel shapes should be the length of data dimensions");for(let u=0;u<t.length-2;u++)$r.adjustPadAndReturnShape(t[u+(s?1:2)],r[u],i[u],a[u],n,u,u+t.length-2,o)}}static computePoolOutputShape(t,r,i,a,n,s,o,u=0){if(r.length<=0)throw new Error("input shape must be of size greater than 0");let l=[r[0],r[1]];return $r.computeShapeHelper(t,r,l,i,a,n,s,o,u),l}static computeConvOutputShape(t,r,i,a,n,s,o){if(t.length<=0||r.length<=0)throw new Error("invalid input tensor dims or invalid filter tensor dims");let u=[t[0],r[0]];return $r.computeShapeHelper(!1,t,u,i,a,n,s,o),u}static computeShapeHelper(t,r,i,a,n,s,o,u,l=0){if(t)for(let p=0;p<r.length-2;p++)i.push(1);else for(let p=0;p<r.length-2;p++)i.push($r.adjustPadAndReturnShape(r[p+2],a[p],n[p],s[p],o,p,p+r.length-2,u,l))}static computeOutputSize(t,r,i,a,n){let s=Math.floor(t/r)+1;return n===1&&(s=Math.ceil(t/r)+1,(s-1)*r>=i+a&&(s-=1)),s}static adjustPadAndReturnShape(t,r,i,a,n,s,o,u,l=0){let p=i*(a-1)+1;if(u&&u!=="NOTSET")switch(u){case"VALID":return n[s]=0,n[o]=0,$r.computeOutputSize(t-p,r,t,0,l);case"SAME_LOWER":case"SAME_UPPER":if(i!==1)throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let d=(Math.floor((t+r-1)/r)-1)*r+a-t;return n[s]=Math.floor(u==="SAME_LOWER"?(d+1)/2:d/2),n[o]=d-n[s],$r.computeOutputSize(t+n[s]+n[o]-p,r,t,n[s],l)}default:throw new Error("Unsupported AutoPad type")}else return $r.computeOutputSize(t+n[s]+n[o]-p,r,t,n[s],l)}},mi=class{static getShapeOfGemmResult(e,t,r,i,a){if(e.length!==2||r.length!==2)throw new Error("shape need to be of size 2");let n,s,o;t?(n=e[1],s=e[0]):(n=e[0],s=e[1]);let u=-1;if(i?(o=r[0],u=1):(o=r[1],u=0),r[u]!==s)throw new Error("dimension mismatch");if(n<=0||o<=0||s<=0)throw new Error("invalid shape specified");if(a&&!Xt.isValidBroadcast(a,[n,o]))throw new Error("gemm: invalid bias shape for broadcast");return[n,o,s]}},ea=-34028234663852886e22,Pt=34028234663852886e22}),Yt,cr=z(()=>{"use strict";le(),Yt=(e,t)=>new(Vr(t))(e)}),sr,jr,Hr,Kr,Ut,Jt,gi,yi,_i,ta,ra,Ia=z(()=>{"use strict";le(),Tt(),sr=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),jr=(e,t)=>{if(t==="int32")return e;let r=sr.get(t);if(!r)throw new Error(`WebNN backend does not support data type: ${t}`);let i=r/8;if(e.byteLength%i!==0)throw new Error(`Invalid Uint8Array length - must be a multiple of ${i}.`);let a=e.byteLength/i,n=new(Vr(t))(e.buffer,e.byteOffset,a);switch(t){case"int64":case"uint64":{let s=new Int32Array(a);for(let o=0;o<a;o++){let u=n[o];if(u>2147483647n||u<-2147483648n)throw new Error("Can not convert int64 data to int32 - value out of range.");s[o]=Number(u)}return new Uint8Array(s.buffer)}case"int8":case"uint8":case"uint32":{if(t==="uint32"&&n.some(o=>o>2147483647))throw new Error("Can not convert uint32 data to int32 - value out of range.");let s=Int32Array.from(n,Number);return new Uint8Array(s.buffer)}default:throw new Error(`Unsupported data conversion from ${t} to 'int32'`)}},Hr=(e,t)=>{if(t==="int32")return e;if(e.byteLength%4!==0)throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");let r=e.byteLength/4,i=new Int32Array(e.buffer,e.byteOffset,r);switch(t){case"int64":{let a=BigInt64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"uint64":{if(i.some(n=>n<0))throw new Error("Can not convert int32 data to uin64 - negative value found.");let a=BigUint64Array.from(i,BigInt);return new Uint8Array(a.buffer)}case"int8":{if(i.some(n=>n<-128||n>127))throw new Error("Can not convert int32 data to int8 - value out of range.");let a=Int8Array.from(i,Number);return new Uint8Array(a.buffer)}case"uint8":{if(i.some(a=>a<0||a>255))throw new Error("Can not convert int32 data to uint8 - value out of range.");return Uint8Array.from(i,Number)}case"uint32":{if(i.some(n=>n<0))throw new Error("Can not convert int32 data to uint32 - negative value found.");let a=Uint32Array.from(i,Number);return new Uint8Array(a.buffer)}default:throw new Error(`Unsupported data conversion from 'int32' to ${t}`)}},Kr=1,Ut=()=>Kr++,Jt=new Map([["int8","int32"],["uint8","int32"],["uint32","int32"],["int64","int32"]]),gi=(e,t)=>{let r=sr.get(e);if(!r)throw new Error(`WebNN backend does not support data type: ${e}`);return t.length>0?Math.ceil(t.reduce((i,a)=>i*a)*r/8):0},yi=class{constructor(e){this.isDataConverted=!1;let{sessionId:t,context:r,tensor:i,dataType:a,shape:n,fallbackDataType:s}=e;this.sessionId=t,this.mlContext=r,this.mlTensor=i,this.dataType=a,this.tensorShape=n,this.fallbackDataType=s}get tensor(){return this.mlTensor}get type(){return this.dataType}get fallbackType(){return this.fallbackDataType}get shape(){return this.tensorShape}get byteLength(){return gi(this.dataType,this.tensorShape)}destroy(){Se("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(e){this.mlContext.writeTensor(this.mlTensor,e)}async read(e){if(this.fallbackDataType){let t=await this.mlContext.readTensor(this.mlTensor),r=Hr(new Uint8Array(t),this.dataType);if(e){(e instanceof ArrayBuffer?new Uint8Array(e):new Uint8Array(e.buffer,e.byteOffset,e.byteLength)).set(r);return}else return new Uint8Array(r).buffer}else return e?this.mlContext.readTensor(this.mlTensor,e):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(e,t,r){return this.mlContext===e&&this.dataType===t&&this.tensorShape.length===r.length&&this.tensorShape.every((i,a)=>i===r[a])}setIsDataConverted(e){this.isDataConverted=e}},_i=class{constructor(e,t){this.tensorManager=e,this.wrapper=t}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(e,t,r,i){let a=this.tensorManager.getMLContext(e),n=this.tensorManager.getMLOpSupportLimits(e),s;if(!(n!=null&&n.input.dataTypes.includes(t))){if(s=Jt.get(t),!s||!(n!=null&&n.input.dataTypes.includes(s)))throw new Error(`WebNN backend does not support data type: ${t}`);Se("verbose",()=>`[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${t} to ${s}`)}if(this.wrapper){if(this.wrapper.canReuseTensor(a,t,r))return this.wrapper.tensor;if(i){if(this.wrapper.byteLength!==gi(t,r))throw new Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let o=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(e,t,r,o,!0,!0,s),i&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(e){let t=e;if(this.wrapper){if(this.wrapper.fallbackType)if(this.wrapper.fallbackType==="int32")t=jr(e,this.wrapper.type),this.wrapper.setIsDataConverted(!0);else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);if(e.byteLength===this.wrapper.byteLength){this.wrapper.write(t);return}else Se("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor()}this.activeUpload?this.activeUpload.set(t):this.activeUpload=new Uint8Array(t)}async download(e){var t,r;if(this.activeUpload){let i=(t=this.wrapper)!=null&&t.isDataConverted?Hr(this.activeUpload,(r=this.wrapper)==null?void 0:r.type):this.activeUpload;if(e){e instanceof ArrayBuffer?new Uint8Array(e).set(i):new Uint8Array(e.buffer,e.byteOffset,e.byteLength).set(i);return}else return i.buffer}if(!this.wrapper)throw new Error("Tensor has not been created.");return e?this.wrapper.read(e):this.wrapper.read()}},ta=class{constructor(e){this.backend=e,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(e){let t=this.backend.getMLContext(e);if(!t)throw new Error("MLContext not found for session.");return t}getMLOpSupportLimits(e){return this.backend.getMLOpSupportLimits(e)}reserveTensorId(){let e=Ut();return this.tensorTrackersById.set(e,new _i(this)),e}releaseTensorId(e){let t=this.tensorTrackersById.get(e);t&&(this.tensorTrackersById.delete(e),t.tensorWrapper&&this.releaseTensor(t.tensorWrapper))}async ensureTensor(e,t,r,i,a){Se("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${t}, dataType: ${r}, shape: ${i}, copyOld: ${a}}`);let n=this.tensorTrackersById.get(t);if(!n)throw new Error("Tensor not found.");return n.ensureTensor(e,r,i,a)}upload(e,t){let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");r.upload(t)}async download(e,t){Se("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${t==null?void 0:t.byteLength}}`);let r=this.tensorTrackersById.get(e);if(!r)throw new Error("Tensor not found.");return r.download(t)}releaseTensorsForSession(e){for(let t of this.freeTensors)t.sessionId===e&&t.destroy();this.freeTensors=this.freeTensors.filter(t=>t.sessionId!==e)}registerTensor(e,t,r,i){let a=this.getMLContext(e),n=Ut(),s=new yi({sessionId:e,context:a,tensor:t,dataType:r,shape:i});return this.tensorTrackersById.set(n,new _i(this,s)),this.externalTensors.add(s),n}async getCachedTensor(e,t,r,i,a,n,s){let o=this.getMLContext(e);for(let[l,p]of this.freeTensors.entries())if(p.canReuseTensor(o,t,r)){Se("verbose",()=>`[WebNN] Reusing tensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}`);let d=this.freeTensors.splice(l,1)[0];return d.sessionId=e,d}Se("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${t}, ${s?`fallbackDataType: ${s},`:""} shape: ${r}}`);let u=await o.createTensor({dataType:s??t,shape:r,dimensions:r,usage:i,writable:a,readable:n});return new yi({sessionId:e,context:o,tensor:u,dataType:t,shape:r,fallbackDataType:s})}releaseTensor(e){this.externalTensors.has(e)&&this.externalTensors.delete(e),this.freeTensors.push(e)}},ra=(...e)=>new ta(...e)}),hr,ia,aa,na=z(()=>{"use strict";le(),_t(),cr(),Ia(),Tt(),hr=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),ia=(e,t)=>{if(e===t)return!0;if(e===void 0||t===void 0)return!1;let r=Object.keys(e).sort(),i=Object.keys(t).sort();return r.length===i.length&&r.every((a,n)=>a===i[n]&&e[a]===t[a])},aa=class{constructor(e){this.tensorManager=ra(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.sessionGraphOutputs=new Map,this.temporaryGraphInputs=[],this.temporaryGraphOutputs=[],this.temporarySessionTensorIds=new Map,this.mlOpSupportLimitsBySessionId=new Map,ci(e.logLevel,!!e.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw new Error("No active session");return this.activeSessionId}onRunStart(e){Se("verbose",()=>`[WebNN] onRunStart {sessionId: ${e}}`),this.activeSessionId=e}onRunEnd(e){Se("verbose",()=>`[WebNN] onRunEnd {sessionId: ${e}}`);let t=this.temporarySessionTensorIds.get(e);if(t){for(let r of t)Se("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${r}}`),this.tensorManager.releaseTensorId(r);this.temporarySessionTensorIds.delete(e),this.activeSessionId=void 0}}async createMLContext(e){if(e instanceof GPUDevice){let r=this.mlContextCache.findIndex(i=>i.gpuDevice===e);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext(e);return this.mlContextCache.push({gpuDevice:e,mlContext:i}),i}}else if(e===void 0){let r=this.mlContextCache.findIndex(i=>i.options===void 0&&i.gpuDevice===void 0);if(r!==-1)return this.mlContextCache[r].mlContext;{let i=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:i}),i}}let t=this.mlContextCache.findIndex(r=>ia(r.options,e));if(t!==-1)return this.mlContextCache[t].mlContext;{let r=await navigator.ml.createContext(e);return this.mlContextCache.push({options:e,mlContext:r}),r}}registerMLContext(e,t){this.mlContextBySessionId.set(e,t);let r=this.sessionIdsByMLContext.get(t);r||(r=new Set,this.sessionIdsByMLContext.set(t,r)),r.add(e),this.mlOpSupportLimitsBySessionId.has(e)||this.mlOpSupportLimitsBySessionId.set(e,t.opSupportLimits()),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(e,this.temporaryGraphInputs),this.temporaryGraphInputs=[]),this.temporaryGraphOutputs.length>0&&(this.sessionGraphOutputs.set(e,this.temporaryGraphOutputs),this.temporaryGraphOutputs=[])}onReleaseSession(e){this.sessionGraphInputs.delete(e),this.sessionGraphOutputs.delete(e);let t=this.mlContextBySessionId.get(e);if(!t)return;this.tensorManager.releaseTensorsForSession(e),this.mlContextBySessionId.delete(e),this.mlOpSupportLimitsBySessionId.delete(e);let r=this.sessionIdsByMLContext.get(t);if(r.delete(e),r.size===0){this.sessionIdsByMLContext.delete(t);let i=this.mlContextCache.findIndex(a=>a.mlContext===t);i!==-1&&this.mlContextCache.splice(i,1)}}getMLContext(e){return this.mlContextBySessionId.get(e)}getMLOpSupportLimits(e){return this.mlOpSupportLimitsBySessionId.get(e)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(e){Se("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${e}}`),this.tensorManager.releaseTensorId(e)}async ensureTensor(e,t,r,i,a){let n=hr.get(r);if(!n)throw new Error(`Unsupported ONNX data type: ${r}`);return this.tensorManager.ensureTensor(e??this.currentSessionId,t,n,i,a)}async createTemporaryTensor(e,t,r){Se("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${t}, shape: ${r}}`);let i=hr.get(t);if(!i)throw new Error(`Unsupported ONNX data type: ${t}`);let a=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(e,a,i,r,!1);let n=this.temporarySessionTensorIds.get(e);return n?n.push(a):this.temporarySessionTensorIds.set(e,[a]),a}uploadTensor(e,t){if(!pe().shouldTransferToMLTensor)throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");Se("verbose",()=>`[WebNN] uploadTensor {tensorId: ${e}, data: ${t.byteLength}}`),this.tensorManager.upload(e,t)}async downloadTensor(e,t){return this.tensorManager.download(e,t)}createMLTensorDownloader(e,t){return async()=>{let r=await this.tensorManager.download(e);return Yt(r,t)}}registerMLTensor(e,t,r,i){let a=hr.get(r);if(!a)throw new Error(`Unsupported ONNX data type: ${r}`);let n=this.tensorManager.registerTensor(e,t,a,i);return Se("verbose",()=>`[WebNN] registerMLTensor {tensor: ${t}, dataType: ${a}, dimensions: ${i}} -> {tensorId: ${n}}`),n}registerGraphInput(e){this.temporaryGraphInputs.push(e)}registerGraphOutput(e){this.temporaryGraphOutputs.push(e)}isGraphInput(e,t){let r=this.sessionGraphInputs.get(e);return r?r.includes(t):!1}isGraphOutput(e,t){let r=this.sessionGraphOutputs.get(e);return r?r.includes(t):!1}isGraphInputOutputTypeSupported(e,t,r=!0){let i=hr.get(wt(t)),a=this.mlOpSupportLimitsBySessionId.get(e);return typeof i>"u"?!1:r?!!(a!=null&&a.input.dataTypes.includes(i)):!!(a!=null&&a.output.dataTypes.includes(i))}flush(){}}}),wi=z(()=>{"use strict"}),$i,bi,Zr,vi,xi,Si,sa,oa,za,un=z(()=>{"use strict";Tt(),wi(),$i=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),bi=[],Zr=e=>Math.ceil(Number(e)/16)*16,vi=e=>{for(let t=0;t<bi.length;t++){let r=bi[t];if(e<=r)return r}return Math.ceil(e/16)*16},xi=1,Si=()=>xi++,sa=async(e,t,r,i)=>{let a=Zr(r),n=e.device.createBuffer({size:a,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let s=e.getCommandEncoder();e.endComputePass(),s.copyBufferToBuffer(t,0,n,0,a),e.flush(),await n.mapAsync(GPUMapMode.READ);let o=n.getMappedRange();if(i){let u=i();return u.set(new Uint8Array(o,0,r)),u}else return new Uint8Array(o.slice(0,r))}finally{n.destroy()}},oa=class{constructor(e){this.backend=e,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[t]of $i)bi.push(t),this.freeBuffers.set(t,[]),this.freeUniformBuffers.set(t,[]);this.sessionCount=0}upload(e,t){let r=t.buffer,i=t.byteOffset,a=t.byteLength,n=Zr(a),s=this.storageCache.get(e);if(!s)throw new Error("gpu data for uploading does not exist");if(Number(s.originalSize)!==a)throw new Error(`inconsistent data size. gpu data size=${s.originalSize}, data size=${a}`);if(n===a&&i%4===0)this.backend.device.queue.writeBuffer(s.gpuData.buffer,0,r,i,a);else{let o=new Uint8Array(n);o.set(t),this.backend.device.queue.writeBuffer(s.gpuData.buffer,0,o,0,n)}Se("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${e})`)}memcpy(e,t){let r=this.storageCache.get(e);if(!r)throw new Error("source gpu data for memcpy does not exist");let i=this.storageCache.get(t);if(!i)throw new Error("destination gpu data for memcpy does not exist");if(r.originalSize!==i.originalSize)throw new Error("inconsistent source and destination gpu data size");let a=Zr(r.originalSize),n=this.backend.getCommandEncoder();this.backend.endComputePass(),n.copyBufferToBuffer(r.gpuData.buffer,0,i.gpuData.buffer,0,a)}registerExternalBuffer(e,t,r){let i;if(r){if(i=r[0],e===r[1])return Se("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, buffer is the same, skip.`),i;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else i=Si();return this.storageCache.set(i,{gpuData:{id:i,type:0,buffer:e},originalSize:t}),Se("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${t}) => id=${i}, registered.`),i}unregisterExternalBuffer(e){e!==void 0&&(this.storageCache.delete(e),Se("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`))}create(e,t=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let r=vi(e),i,a=(t&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,n=(t&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(a||n){let o=(a?this.freeBuffers:this.freeUniformBuffers).get(r);o?o.length>0?i=o.pop():i=this.backend.device.createBuffer({size:r,usage:t}):i=this.backend.device.createBuffer({size:r,usage:t})}else i=this.backend.device.createBuffer({size:r,usage:t});let s={id:Si(),type:0,buffer:i};return this.storageCache.set(s.id,{gpuData:s,originalSize:Number(e)}),Se("verbose",()=>`[WebGPU] GpuDataManager.create(size=${e}) => id=${s.id}`),s}get(e){var t;return(t=this.storageCache.get(e))==null?void 0:t.gpuData}release(e){let t=typeof e=="bigint"?Number(e):e,r=this.storageCache.get(t);if(!r){if(this.storageCache.size===0)return 0;throw new Error("releasing data does not exist")}return Se("verbose",()=>`[WebGPU] GpuDataManager.release(id=${t}), gpuDataId=${r.gpuData.id}`),this.storageCache.delete(t),this.buffersPending.push(r.gpuData.buffer),r.originalSize}async download(e,t){let r=this.storageCache.get(Number(e));if(!r)throw new Error("data does not exist");await sa(this.backend,r.gpuData.buffer,r.originalSize,t)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let e of this.buffersPending){let t=$i.get(e.size);if((e.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let r=this.freeBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else if((e.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let r=this.freeUniformBuffers.get(e.size)||[];t===void 0||r.length>=t?e.destroy():r.push(e)}else e.destroy()}this.buffersPending=[]}else{let e=this.capturedPendingBuffers.get(this.backend.currentSessionId);e||(e=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,e));for(let t of this.buffersPending)e.push(t);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.freeUniformBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache.forEach(e=>{e.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach(e=>{e.forEach(t=>{t.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(e){let t=this.capturedPendingBuffers.get(e);t&&(t.forEach(r=>{r.destroy()}),this.capturedPendingBuffers.delete(e)),this.sessionCount-=1,this.sessionCount===0&&(Se("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach(r=>{r.gpuData.buffer.destroy()}),this.storageCache=new Map)}},za=(...e)=>new oa(...e)}),c,g,$=z(()=>{"use strict";c=class{constructor(e){Object.assign(this,e)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map(e=>`${this[e]}`).join(";")),this.key}},g=e=>new c(e)}),T,v,A,k,I,R,N,F,U,D,Y,O,q,Pe,me,ye,Ue,Q=z(()=>{"use strict";le(),re(),T=64,v=(e,t)=>{if(t===3)throw new Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(e)){case 10:return t>1?`vec${t}<f16>`:"f16";case 1:return t>1?`vec${t}<f32>`:"f32";case 6:return t>1?`vec${t}<i32>`:"i32";case 12:return t>1?`vec${t}<u32>`:"u32";case 7:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(t>1)throw new Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(t!==4)throw new Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw new Error(`Unknown data type: ${e}`)}},A=(e,t=1)=>{let r=v(e,t);return typeof r=="string"?r:r[0]},k=(e,t=1)=>{let r=v(e,t);return typeof r=="string"?r:r[1]},I=(...e)=>{let t=[];return e.forEach(r=>{r.length!==0&&t.push({type:12,data:r},{type:12,data:M.computeStrides(r)})}),t},R=e=>e%4===0?4:e%2===0?2:1,N=(e="f32",t,r="0")=>!t||t===1?`${e}(${r})`:`vec${t}<${e}>(${r})`,F=(e,t,r)=>e==="f32"?r:t===1?`f32(${r})`:`vec${t}<f32>(${r})`,U=(e,t)=>t===4?`(${e}.x + ${e}.y + ${e}.z + ${e}.w)`:t===2?`(${e}.x + ${e}.y)`:t===3?`(${e}.x + ${e}.y + ${e}.z)`:e,D=(e,t,r,i)=>e.startsWith("uniforms.")&&r>4?typeof t=="string"?i==="f16"?`${e}[(${t}) / 8][(${t}) % 8 / 4][(${t}) % 8 % 4]`:`${e}[(${t}) / 4][(${t}) % 4]`:i==="f16"?`${e}[${Math.floor(t/8)}][${Math.floor(t%8/4)}][${t%8%4}]`:`${e}[${Math.floor(t/4)}][${t%4}]`:r>1?`${e}[${t}]`:e,Y=(e,t,r,i,a)=>{let n=typeof r=="number",s=n?r:r.length,o=[...new Array(s).keys()],u=s<2?"u32":s<=4?`vec${s}<u32>`:`array<u32, ${s}>`,l=v(t,a),p=typeof l=="string"?l:l[1],d=typeof l=="string"?l:l[0],h={indices:u,value:p,storage:d,tensor:t},m=G=>typeof G=="string"?G:`${G}u`,f={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},_=n?"uniforms.":"",b=`${_}${e}_shape`,w=`${_}${e}_strides`,y="";for(let G=0;G<s-1;G++)y+=`
    let dim${G} = current / ${D(w,G,s)};
    let rest${G} = current % ${D(w,G,s)};
    indices[${G}] = dim${G};
    current = rest${G};
    `;y+=`indices[${s-1}] = current;`;let x=s<2?"":`
  fn o2i_${e}(offset: u32) -> ${h.indices} {
    var indices: ${h.indices};
    var current = offset;
    ${y}
    return indices;
  }`,S=G=>(f.offsetToIndices=!0,s<2?G:`o2i_${e}(${G})`),E=[];if(s>=2)for(let G=s-1;G>=0;G--)E.push(`${D(w,G,s)} * (indices[${G}])`);let C=s<2?"":`
  fn i2o_${e}(indices: ${h.indices}) -> u32 {
    return ${E.join("+")};
  }`,B=G=>(f.indicesToOffset=!0,s<2?G:`i2o_${e}(${G})`),P=(...G)=>s===0?"0u":`${h.indices}(${G.map(m).join(",")})`,L=(G,K)=>s<2?`${G}`:`${D(G,K,s)}`,W=(G,K,J)=>s<2?`${G}=${J};`:`${D(G,K,s)}=${J};`,oe={},X=(G,K)=>{f.broadcastedIndicesToOffset=!0;let J=`${K.name}broadcastedIndicesTo${e}Offset`;if(J in oe)return`${J}(${G})`;let H=[];for(let Re=s-1;Re>=0;Re--){let lr=K.indicesGet("outputIndices",Re+K.rank-s);H.push(`${L(w,Re)} * (${lr} % ${L(b,Re)})`)}return oe[J]=`fn ${J}(outputIndices: ${K.type.indices}) -> u32 {
             return ${H.length>0?H.join("+"):"0u"};
           }`,`${J}(${G})`},ee=(G,K)=>(()=>{if(h.storage===h.value)return`${e}[${G}]=${K};`;if(h.storage==="vec2<u32>"&&h.value==="i32")return`${e}[${G}]=vec2<u32>(u32(${K}), select(0u, 0xFFFFFFFFu, ${K} < 0));`;if(h.storage==="vec2<u32>"&&h.value==="u32")return`${e}[${G}]=vec2<u32>(u32(${K}), 0u);`;if(h.storage==="u32"&&h.value==="vec4<bool>")return`${e}[${G}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${K}));`;throw new Error(`not supported combination of storage type ${h.storage} and value type ${h.value} yet`)})(),Ee=G=>(()=>{if(h.storage===h.value)return`${e}[${G}]`;if(h.storage==="vec2<u32>"&&h.value==="i32")return`i32(${e}[${G}].x)`;if(h.storage==="vec2<u32>"&&h.value==="u32")return`u32(${e}[${G}].x)`;if(h.storage==="u32"&&h.value==="vec4<bool>")return`vec4<bool>(bool(${e}[${G}] & 0xFFu), bool(${e}[${G}] & 0xFF00u), bool(${e}[${G}] & 0xFF0000u), bool(${e}[${G}] & 0xFF000000u))`;throw new Error(`not supported combination of storage type ${h.storage} and value type ${h.value} yet`)})(),ke=s<2?"":`
  fn get_${e}ByIndices(indices: ${h.indices}) -> ${p} {
    return ${Ee(`i2o_${e}(indices)`)};
  }`,ae=s<2?"":(()=>{let G=o.map(J=>`d${J}: u32`).join(", "),K=o.map(J=>`d${J}`).join(", ");return`
  fn get_${e}(${G}) -> ${p} {
    return get_${e}ByIndices(${P(K)});
  }`})(),ce=(...G)=>{if(G.length!==s)throw new Error(`indices length must be ${s}`);let K=G.map(m).join(",");return s===0?Ee("0u"):s===1?Ee(K[0]):(f.get=!0,f.getByIndices=!0,f.indicesToOffset=!0,`get_${e}(${K})`)},Qe=G=>s<2?Ee(G):(f.getByIndices=!0,f.indicesToOffset=!0,`get_${e}ByIndices(${G})`),j=s<2?"":`
  fn set_${e}ByIndices(indices: ${h.indices}, value: ${p}) {
    ${ee(`i2o_${e}(indices)`,"value")}
  }`,Ce=s<2?"":(()=>{let G=o.map(J=>`d${J}: u32`).join(", "),K=o.map(J=>`d${J}`).join(", ");return`
  fn set_${e}(${G}, value: ${p}) {
    set_${e}ByIndices(${P(K)}, value);
  }`})();return{impl:()=>{let G=[],K=!1;return f.offsetToIndices&&(G.push(x),K=!0),f.indicesToOffset&&(G.push(C),K=!0),f.broadcastedIndicesToOffset&&(Object.values(oe).forEach(J=>G.push(J)),K=!0),f.set&&(G.push(Ce),K=!0),f.setByIndices&&(G.push(j),K=!0),f.get&&(G.push(ae),K=!0),f.getByIndices&&(G.push(ke),K=!0),!n&&K&&G.unshift(`const ${b} = ${h.indices}(${r.join(",")});`,`const ${w} = ${h.indices}(${M.computeStrides(r).join(",")});`),G.join(`
`)},type:h,offsetToIndices:S,indicesToOffset:B,broadcastedIndicesToOffset:X,indices:P,indicesGet:L,indicesSet:W,set:(...G)=>{if(G.length!==s+1)throw new Error(`indices length must be ${s}`);let K=G[s];if(typeof K!="string")throw new Error("value must be string");let J=G.slice(0,s).map(m).join(",");return s===0?ee("0u",K):s===1?ee(J[0],K):(f.set=!0,f.setByIndices=!0,f.indicesToOffset=!0,`set_${e}(${J}, ${K})`)},setByOffset:ee,setByIndices:(G,K)=>s<2?ee(G,K):(f.setByIndices=!0,f.indicesToOffset=!0,`set_${e}ByIndices(${G}, ${K});`),get:ce,getByOffset:Ee,getByIndices:Qe,usage:i,name:e,strides:w,shape:b,rank:s}},O=(e,t,r,i=1)=>Y(e,t,r,"input",i),q=(e,t,r,i=1)=>Y(e,t,r,"output",i),Pe=(e,t,r)=>Y(e,t,r,"atomicOutput",1),me=(e,t,r,i=1)=>Y(e,t,r,"internal",i),ye=class{constructor(e,t){this.normalizedDispatchGroup=e,this.limits=t,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(e){return`if (global_idx >= ${typeof e=="number"?`${e}u`:e}) { return; }`}mainStart(e=T){let t=typeof e=="number"?e:e[0],r=typeof e=="number"?1:e[1],i=typeof e=="number"?1:e[2];if(t>this.limits.maxComputeWorkgroupSizeX||r>this.limits.maxComputeWorkgroupSizeY||i>this.limits.maxComputeWorkgroupSizeZ)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(t*r*i>this.limits.maxComputeInvocationsPerWorkgroup)throw new Error(`workgroup size [${t}, ${r}, ${i}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let a=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,n=a?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,s=a?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${t*r*i}u + local_idx;`;return`@compute @workgroup_size(${t}, ${r}, ${i})
  fn main(${n}) {
    ${s}
  `}appendVariableUniforms(e){e.rank!==0&&(e.shape.startsWith("uniforms.")&&this.uniforms.push({name:e.shape.replace("uniforms.",""),type:"u32",length:e.rank}),e.strides.startsWith("uniforms.")&&this.uniforms.push({name:e.strides.replace("uniforms.",""),type:"u32",length:e.rank}))}declareVariable(e,t){if(e.usage==="internal")throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(e),this.appendVariableUniforms(e);let r=e.usage==="input"?"read":"read_write",i=e.usage==="atomicOutput"?"atomic<i32>":e.type.storage;return`@group(0) @binding(${t}) var<storage, ${r}> ${e.name}: array<${i}>;`}declareVariables(...e){return e.map(t=>this.declareVariable(t,this.variableIndex++)).join(`
`)}registerInternalVariable(e){if(e.usage!=="internal")throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(e),this.appendVariableUniforms(e)}registerInternalVariables(...e){return e.forEach(t=>this.registerInternalVariable(t)),this}registerUniform(e,t,r=1){return this.uniforms.push({name:e,type:t,length:r}),this}registerUniforms(e){return this.uniforms=this.uniforms.concat(e),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let e=[];for(let{name:t,type:r,length:i}of this.uniforms)if(i&&i>4)r==="f16"?e.push(`@align(16) ${t}:array<mat2x4<${r}>, ${Math.ceil(i/8)}>`):e.push(`${t}:array<vec4<${r}>, ${Math.ceil(i/4)}>`);else{let a=i==null||i===1?r:`vec${i}<${r}>`;e.push(`${t}:${a}`)}return`
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map(e=>e.impl()).join(`
`)+this.internalVariables.map(e=>e.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let e=t=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(t)];return this.uniforms.map(t=>[e(t.type),t.length??1])}},Ue=(e,t)=>new ye(e,t)}),Et,Le,Ie,rt,vt,it,at,ua,la,Nt=z(()=>{"use strict";le(),re(),$(),Q(),Et=(e,t)=>{if(!e||e.length!==1)throw new Error("Transpose requires 1 input.");if(t.length!==0&&t.length!==e[0].dims.length)throw new Error(`perm size ${t.length} does not match input rank ${e[0].dims.length}`)},Le=(e,t)=>t.length!==0?t:[...new Array(e).keys()].reverse(),Ie=(e,t)=>M.sortBasedOnPerm(e,Le(e.length,t)),rt=(e,t,r,i)=>{let a=`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;for(let n=0;n<t;++n)a+=`a[${e[n]}]=i[${n}];`;return a+="return a;}"},vt=(e,t)=>{let r=[],i=[];for(let a=0;a<e.length;++a)e[a]!==1&&r.push(e[a]),e[t[a]]!==1&&i.push(t[a]);return{newShape:r,newPerm:i}},it=(e,t)=>{let r=0;for(let i=0;i<e.length;++i)if(t[e[i]]!==1){if(e[i]<r)return!1;r=e[i]}return!0},at=(e,t)=>{let r=e.dataType,i=e.dims.length,a=Le(i,t),n=Ie(e.dims,a),s=e.dims,o=n,u=i<2||it(a,e.dims),l;if(u)return l=f=>{let _=O("input",r,s,4),b=q("output",r,o,4);return`
  ${f.registerUniform("output_size","u32").declareVariables(_,b)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let f=M.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(f/64/4)},programUniforms:[{type:12,data:Math.ceil(f/4)}]}},getShaderSource:l};let{newShape:p,newPerm:d}=vt(e.dims,a),h=M.areEqual(d,[2,3,1]),m=M.areEqual(d,[3,1,2]);if(p.length===2||h||m){s=h?[p[0],p[1]*p[2]]:m?[p[0]*p[1],p[2]]:p,o=[s[1],s[0]];let f=16;return l=_=>{let b=O("a",r,s.length),w=q("output",r,o.length);return`
  ${_.registerUniform("output_size","u32").declareVariables(b,w)}
  var<workgroup> tile : array<array<${w.type.value}, ${f+1}>, ${f}>;
  ${_.mainStart([f,f,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${f} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${f}u + local_id.x;
    let input_row = workgroup_id_x * ${f}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${b.getByIndices(`${b.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${f}u + local_id.x;
    let output_row = workgroup_id_y * ${f}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${w.setByIndices(`${w.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let _=M.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(o[1]/f),y:Math.ceil(o[0]/f)},programUniforms:[{type:12,data:_},...I(s,o)]}},getShaderSource:l}}return l=f=>{let _=O("a",r,s.length),b=q("output",r,o.length);return`
  ${f.registerUniform("output_size","u32").declareVariables(_,b)}

  ${rt(a,i,_,b)}

  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${b.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${b.setByOffset("global_idx",_.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${t}`,inputDependencies:["rank"]},getRunData:()=>{let f=M.size(n);return{outputs:[{dims:n,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},...I(s,o)]}},getShaderSource:l}},ua=(e,t)=>{Et(e.inputs,t.perm),e.compute(at(e.inputs[0],t.perm))},la=e=>g({perm:e.perm})}),kt,Ot,da,Te,It,Ca,Lt,Qr,Ke,pt,gt,Xr,pa,Oa,Vt,Ft,fr,Ze,Fe,At,Aa,ln=z(()=>{"use strict";le(),re(),Q(),pn(),Nt(),kt={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},Ot={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},da={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},Te={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},It=(e,t)=>{let r=[];for(let i=t-e;i<t;++i)r.push(i);return r},Ca=(e,t)=>{let r=[],i=e.length;for(let n=0;n<i;n++)t.indexOf(n)===-1&&r.push(e[n]);let a=t.map(n=>e[n]);return[r,a]},Lt=(e,t)=>{let r=e.length+t.length,i=[],a=0;for(let n=0;n<r;n++)t.indexOf(n)===-1?i.push(e[a++]):i.push(1);return i},Qr=(e,t)=>{for(let r=0;r<e.length;++r)if(e[e.length-r-1]!==t-1-r)return!1;return!0},Ke=(e,t)=>{let r=[];if(!Qr(e,t)){for(let i=0;i<t;++i)e.indexOf(i)===-1&&r.push(i);e.forEach(i=>r.push(i))}return r},pt=(e,t,r,i,a,n,s)=>{let o=r[0].dims,u=M.size(n),l=M.size(s),p=O("_A",r[0].dataType,o),d=q("output",a,n),h=64;u===1&&(h=256);let m=`
          var<workgroup> aBestValues : array<f32, ${h}>;
       `,f=_=>`
        ${_.registerUniform("reduceSize","u32").declareVariables(p,d)}
        ${m}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${_.mainStart(h)}

          let outputIndex = global_idx / ${h};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${da[i]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${h}) {
           let candidate = f32(${p.getByOffset("offset + k")});
           bestValue = ${kt[i]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${h}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${Ot[i]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${d.setByOffset("outputIndex",`${i==="mean"?`${d.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${d.type.storage}(${Te[i]})`}`)};
         }
        }`;return{name:e,shaderCache:{hint:`${t};${h}`,inputDependencies:["type"]},getShaderSource:f,getRunData:()=>({outputs:[{dims:n,dataType:a}],dispatchGroup:{x:u},programUniforms:[{type:12,data:l}]})}},gt=(e,t,r,i)=>{let a=e.inputs.length===1?r:dn(e.inputs,r),n=a.axes;n.length===0&&!a.noopWithEmptyAxes&&(n=e.inputs[0].dims.map((m,f)=>f));let s=M.normalizeAxes(n,e.inputs[0].dims.length),o=s,u=e.inputs[0],l=Ke(o,e.inputs[0].dims.length);l.length>0&&(u=e.compute(at(e.inputs[0],l),{inputs:[0],outputs:[-1]})[0],o=It(o.length,u.dims.length));let[p,d]=Ca(u.dims,o),h=p;a.keepDims&&(h=Lt(p,s)),e.compute(pt(t,a.cacheKey,[u],i,e.inputs[0].dataType,h,d),{inputs:[u]})},Xr=(e,t)=>{gt(e,"ReduceMeanShared",t,"mean")},pa=(e,t)=>{gt(e,"ReduceL1Shared",t,"l1")},Oa=(e,t)=>{gt(e,"ReduceL2Shared",t,"l2")},Vt=(e,t)=>{gt(e,"ReduceLogSumExpShared",t,"logSumExp")},Ft=(e,t)=>{gt(e,"ReduceMaxShared",t,"max")},fr=(e,t)=>{gt(e,"ReduceMinShared",t,"min")},Ze=(e,t)=>{gt(e,"ReduceProdShared",t,"prod")},Fe=(e,t)=>{gt(e,"ReduceSumShared",t,"sum")},At=(e,t)=>{gt(e,"ReduceSumSquareShared",t,"sumSquare")},Aa=(e,t)=>{gt(e,"ReduceLogSumShared",t,"logSum")}}),qt,vs,Ra,dn,Gt,xs,Ss,Ts,Es,ks,Is,zs,Cs,Os,As,Wt,Rs,Bs,Ms,Ds,Ps,Us,Ns,Ls,Vs,Fs,pn=z(()=>{"use strict";le(),re(),$(),Q(),ln(),qt=e=>{if(!e||e.length===0||e.length>2)throw new Error("Reduce op requires 1 or 2 inputs.");if(e.length===2&&e[1].dims.length!==1)throw new Error("Invalid axes input dims.")},vs=e=>["","",`var value = ${e.getByIndices("input_indices")};`,""],Ra=(e,t,r,i,a,n,s=!1,o=!1)=>{let u=[],l=r[0].dims,p=l.length,d=M.normalizeAxes(a,p),h=!o&&d.length===0;l.forEach((_,b)=>{h||d.indexOf(b)>=0?s&&u.push(1):u.push(_)});let m=u.length,f=M.size(u);return{name:e,shaderCache:t,getShaderSource:_=>{let b=[],w=O("_A",r[0].dataType,p),y=q("output",n,m),x=i(w,y,d),S=x[2];for(let E=0,C=0;E<p;E++)h||d.indexOf(E)>=0?(s&&C++,S=`for(var j${E}: u32 = 0; j${E} < ${l[E]}; j${E}++) {
                  ${x[2].includes("last_index")?`let last_index = j${E};`:""}
                  ${w.indicesSet("input_indices",E,`j${E}`)}
                  ${S}
                }`):(b.push(`${w.indicesSet("input_indices",E,y.indicesGet("output_indices",C))};`),C++);return`

        ${_.registerUniform("output_size","u32").declareVariables(w,y)}

        ${_.mainStart()}
          ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${w.type.indices};
          let output_indices = ${y.offsetToIndices("global_idx")};

          ${b.join(`
`)}
          ${x[0]}       // init ops for reduce max/min
          ${x[1]}
          ${S}
          ${x[3]}
          ${x.length===4?y.setByOffset("global_idx","value"):x.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:u,dataType:n}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:[{type:12,data:f},...I(l,u)]})}},dn=(e,t)=>{let r=[];return e[1].dims[0]>0&&e[1].getBigInt64Array().forEach(i=>r.push(Number(i))),g({axes:r,keepDims:t.keepDims,noopWithEmptyAxes:t.noopWithEmptyAxes})},Gt=(e,t,r,i)=>{let a=e.inputs,n=a.length===1?r:dn(a,r);e.compute(Ra(t,{hint:n.cacheKey,inputDependencies:["rank"]},[a[0]],n.noopWithEmptyAxes&&n.axes.length===0?vs:i,n.axes,a[0].dataType,n.keepDims,n.noopWithEmptyAxes),{inputs:[0]})},xs=(e,t)=>{qt(e.inputs),Gt(e,"ReduceLogSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,"value = log(value);"])},Ss=(e,t)=>{qt(e.inputs),Gt(e,"ReduceL1",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += abs(${r.getByIndices("input_indices")});`,""])},Ts=(e,t)=>{qt(e.inputs),Gt(e,"ReduceL2",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},Es=(e,t)=>{qt(e.inputs),Gt(e,"ReduceLogSumExp",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += exp(${r.getByIndices("input_indices")});`,"value = log(value);"])},ks=(e,t)=>{qt(e.inputs),Gt(e,"ReduceMax",t,(r,i,a)=>{let n=[];for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&n.push(r.indicesSet("input_indices",s,0));return[`${n.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = max(value, ${r.getByIndices("input_indices")});`,""]})},Is=(e,t)=>{qt(e.inputs),Gt(e,"ReduceMean",t,(r,i,a)=>{let n=1;for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&(n*=e.inputs[0].dims[s]);return["var sum = f32(0);","",`sum += f32(${r.getByIndices("input_indices")});`,`let value = ${i.type.value}(sum / ${n});`]})},zs=(e,t)=>{qt(e.inputs),Gt(e,"ReduceMin",t,(r,i,a)=>{let n=[];for(let s=0;s<r.rank;s++)(a.indexOf(s)>=0||a.length===0)&&n.push(`input_indices[${s}] = 0;`);return[`${n.join(`
`)}`,`var value = ${r.getByIndices("input_indices")};`,`value = min(value, ${r.getByIndices("input_indices")});`,""]})},Cs=(e,t)=>{qt(e.inputs),Gt(e,"ReduceProd",t,(r,i)=>[`var value = ${i.type.storage}(1);`,"",`value *= ${r.getByIndices("input_indices")};`,""])},Os=(e,t)=>{qt(e.inputs),Gt(e,"ReduceSum",t,(r,i)=>[`var value = ${i.type.storage}(0);`,"",`value += ${r.getByIndices("input_indices")};`,""])},As=(e,t)=>{qt(e.inputs),Gt(e,"ReduceSumSquare",t,(r,i)=>[`var t = ${i.type.value}(0); var value = ${i.type.value}(0);`,"",`t = ${r.getByIndices("input_indices")}; value += t * t;`,""])},Wt=(e,t,r)=>{if(t.length===0)return r;let i=1,a=1;for(let n=0;n<t.length;n++)t.indexOf(n)===-1?i*=e[n]:a*=e[n];return a<32&&i>1024},Rs=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Is(e,t):Xr(e,t)},Bs=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ss(e,t):pa(e,t)},Ms=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Ts(e,t):Oa(e,t)},Ds=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Es(e,t):Vt(e,t)},Ps=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?ks(e,t):Ft(e,t)},Us=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?zs(e,t):fr(e,t)},Ns=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Cs(e,t):Ze(e,t)},Ls=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?Os(e,t):Fe(e,t)},Vs=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?As(e,t):At(e,t)},Fs=(e,t)=>{Wt(e.inputs[0].dims,t.axes,t.noopWithEmptyAxes)?xs(e,t):Aa(e,t)}}),cn,qs,Gs,hn,Ec=z(()=>{"use strict";le(),$(),pn(),cn=e=>{if(!e||e.length===0||e.length>2)throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(e[0].dataType!==1)throw new Error("Invalid input type.")},qs=(e,t)=>{cn(e.inputs);let r=(i,a,n)=>{let s=[];for(let o=0;o<i.rank;o++)(n.indexOf(o)>=0||n.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?"<=":"<"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(Ra("ArgMin",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},Gs=(e,t)=>{cn(e.inputs);let r=(i,a,n)=>{let s=[];for(let o=0;o<i.rank;o++)(n.indexOf(o)>=0||n.length===0)&&s.push(`input_indices[${o}] = 0;`);return[`${s.join(`
`)}`,`var value = ${i.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${i.getByIndices("input_indices")} ${t.selectLastIndex>0?">=":">"} value) {
         value = ${i.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",a.setByOffset("global_idx","best_index")]};e.compute(Ra("argMax",{hint:t.cacheKey,inputDependencies:["rank"]},[e.inputs[0]],r,[t.axis],7,t.keepDims),{inputs:[0]})},hn=e=>g(e)}),Ws,Ba,js,Hs,Ks,ca,Zs,Qs,fn=z(()=>{"use strict";le(),re(),wi(),Q(),Ws=(e,t)=>{let r=e[0],i=e[1],a=e[2],n=e[3],s=e[4],o=e[5];if(s&&o)throw new Error("Attention cannot have both past and attention_bias");if(r.dims.length!==3)throw new Error('Input "input" must have 3 dimensions');let u=r.dims[0],l=r.dims[1],p=r.dims[2];if(a.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimensions');if(i.dims.length!==2)throw new Error('Input "weights" is expected to have 2 dimensions');if(i.dims[0]!==p)throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(a.dims[0]!==i.dims[1])throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let d=a.dims[0]/3,h=d,m=h;if(t.qkvHiddenSizes.length>0){if(t.qkvHiddenSizes.length!==3)throw new Error("qkv_hidden_sizes attribute should have 3 elements");for(let x of t.qkvHiddenSizes)if(x%t.numHeads!==0)throw new Error("qkv_hidden_sizes should be divisible by num_heads");d=t.qkvHiddenSizes[0],h=t.qkvHiddenSizes[1],m=t.qkvHiddenSizes[2]}let f=l;if(d!==h)throw new Error("qkv_hidden_sizes first element should be same as the second");if(a.dims[0]!==d+h+m)throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let _=0;if(s){if(h!==m)throw new Error('Input "past" expect k_hidden_size == v_hidden_size');if(s.dims.length!==5)throw new Error('Input "past" must have 5 dimensions');if(s.dims[0]!==2)throw new Error('Input "past" first dimension must be 2');if(s.dims[1]!==u)throw new Error('Input "past" second dimension must be batch_size');if(s.dims[2]!==t.numHeads)throw new Error('Input "past" third dimension must be num_heads');if(s.dims[4]!==h/t.numHeads)throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');t.pastPresentShareBuffer||(_=s.dims[3])}let b=f+_,w=-1,y=0;if(n)throw new Error("Mask not supported");if(s)throw new Error("past is not supported");if(o){if(o.dims.length!==4)throw new Error('Input "attention_bias" must have 4 dimensions');if(o.dims[0]!==u||o.dims[1]!==t.numHeads||o.dims[2]!==l||o.dims[3]!==b)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:u,sequenceLength:l,pastSequenceLength:_,kvSequenceLength:f,totalSequenceLength:b,maxSequenceLength:w,inputHiddenSize:p,hiddenSize:d,vHiddenSize:m,headSize:Math.floor(d/t.numHeads),vHeadSize:Math.floor(m/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},Ba=(e,t,r)=>t&&e?`
      let total_sequence_length_input = u32(${t.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${e==null?void 0:e.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${r?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,js=(e,t,r,i,a,n,s,o)=>{let u=R(s?1:n),l=64,p=n/u;p<l&&(l=32);let d=Math.ceil(n/u/l),h=[{type:12,data:t},{type:12,data:r},{type:12,data:i},{type:12,data:a},{type:12,data:p},{type:12,data:d}],m=A(e.dataType,u),f=k(1,u),_=["type"];s&&_.push("type"),o&&_.push("type");let b=w=>{let y=q("x",e.dataType,e.dims,u),x=[y],S=s?O("seq_lens",s.dataType,s.dims):void 0;S&&x.push(S);let E=o?O("total_sequence_length_input",o.dataType,o.dims):void 0;E&&x.push(E);let C=k(e.dataType),B=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${l}>;
  var<workgroup> thread_sum: array<f32, ${l}>;
  ${w.registerUniforms(B).declareVariables(...x)}
  ${w.mainStart([l,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${Ba(S,E,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${l}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${s?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${f}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${f}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(u){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw new Error(`Unsupported components: ${u}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${l}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${f}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${f}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(u){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw new Error(`Unsupported components: ${u}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${l}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${y.type.value}(${C}(1.0) / ${C}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${f}(x[offset + i]);
        x[offset + i] = ${y.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${s?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${y.type.value}(${C}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${l};${m};${u}`,inputDependencies:_},getShaderSource:b,getRunData:()=>({outputs:[],dispatchGroup:{x:1,y:a,z:t*r},programUniforms:h})}},Hs=(e,t,r,i,a,n,s,o,u)=>{let l=s+n.kvSequenceLength,p=[n.batchSize,n.numHeads,n.sequenceLength,l],d=e>1&&i,h=n.kvNumHeads?n.kvNumHeads:n.numHeads,m=d?[n.batchSize,h,l,n.headSize]:void 0,f=n.nReps?n.nReps:1,_=n.scale===0?1/Math.sqrt(n.headSize):n.scale,b=R(n.headSize),w=n.headSize/b,y=12,x={x:Math.ceil(l/y),y:Math.ceil(n.sequenceLength/y),z:n.batchSize*n.numHeads},S=[{type:12,data:n.sequenceLength},{type:12,data:w},{type:12,data:l},{type:12,data:n.numHeads},{type:12,data:n.headSize},{type:1,data:_},{type:12,data:s},{type:12,data:n.kvSequenceLength},{type:12,data:f}],E=d&&i&&M.size(i.dims)>0,C=["type","type"];E&&C.push("type"),a&&C.push("type"),o&&C.push("type"),u&&C.push("type");let B=[{dims:p,dataType:t.dataType,gpuDataType:0}];d&&B.push({dims:m,dataType:t.dataType,gpuDataType:0});let P=L=>{let W=O("q",t.dataType,t.dims,b),oe=O("key",r.dataType,r.dims,b),X=[W,oe];if(E){let j=O("past_key",i.dataType,i.dims,b);X.push(j)}a&&X.push(O("attention_bias",a.dataType,a.dims));let ee=o?O("seq_lens",o.dataType,o.dims):void 0;ee&&X.push(ee);let Ee=u?O("total_sequence_length_input",u.dataType,u.dims):void 0;Ee&&X.push(Ee);let ke=q("output",t.dataType,p),ae=[ke];d&&ae.push(q("present_key",t.dataType,m,b));let ce=k(1,b),Qe=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${y}u;

  var<workgroup> tileQ: array<${W.type.storage}, ${y*y}>;
  var<workgroup> tileK: array<${W.type.storage}, ${y*y}>;
  ${L.registerUniforms(Qe).declareVariables(...X,...ae)}
  ${L.mainStart([y,y,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${f===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${f===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${Ba(ee,Ee,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${E&&d?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${d?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${ce}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${E&&d?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${d?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${ce}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(b){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw new Error(`Unsupported components: ${b}`)}})()};
        output[outputIdx] = ${ke.type.value} (sum * uniforms.alpha) + ${a?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${b};${a!==void 0};${i!==void 0};${e}`,inputDependencies:C},getRunData:()=>({outputs:B,dispatchGroup:x,programUniforms:S}),getShaderSource:P}},Ks=(e,t,r,i,a,n,s=void 0,o=void 0)=>{let u=n+a.kvSequenceLength,l=a.nReps?a.nReps:1,p=a.vHiddenSize*l,d=e>1&&i,h=a.kvNumHeads?a.kvNumHeads:a.numHeads,m=d?[a.batchSize,h,u,a.headSize]:void 0,f=[a.batchSize,a.sequenceLength,p],_=12,b={x:Math.ceil(a.vHeadSize/_),y:Math.ceil(a.sequenceLength/_),z:a.batchSize*a.numHeads},w=[{type:12,data:a.sequenceLength},{type:12,data:u},{type:12,data:a.vHeadSize},{type:12,data:a.numHeads},{type:12,data:a.headSize},{type:12,data:p},{type:12,data:n},{type:12,data:a.kvSequenceLength},{type:12,data:l}],y=d&&i&&M.size(i.dims)>0,x=["type","type"];y&&x.push("type"),s&&x.push("type"),o&&x.push("type");let S=[{dims:f,dataType:t.dataType,gpuDataType:0}];d&&S.push({dims:m,dataType:t.dataType,gpuDataType:0});let E=C=>{let B=O("probs",t.dataType,t.dims),P=O("v",r.dataType,r.dims),L=[B,P];y&&L.push(O("past_value",i.dataType,i.dims));let W=s?O("seq_lens",s.dataType,s.dims):void 0;s&&L.push(W);let oe=o?O("total_sequence_length_input",o.dataType,o.dims):void 0;o&&L.push(oe);let X=[q("output",t.dataType,f)];d&&X.push(q("present_value",t.dataType,m));let ee=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${_}u;
  var<workgroup> tileQ: array<${B.type.value}, ${_*_}>;
  var<workgroup> tileV: array<${B.type.value}, ${_*_}>;
  ${C.registerUniforms(ee).declareVariables(...L,...X)}
  ${C.mainStart([_,_,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${l===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${l===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${Ba(W,oe,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${y&&d?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${d?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${B.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${y&&d?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${d?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${i!==void 0};${e}`,inputDependencies:x},getRunData:()=>({outputs:S,dispatchGroup:b,programUniforms:w}),getShaderSource:E}},ca=(e,t,r,i,a,n,s,o,u,l,p=void 0,d=void 0)=>{let h=Math.min(e.outputCount,1+(s?1:0)+(o?1:0)),m=h>1?s:void 0,f=h>1?o:void 0,_=h>1?l.pastSequenceLength:0,b=_+l.kvSequenceLength,w=u&&M.size(u.dims)>0?u:void 0,y=[t,r];m&&M.size(m.dims)>0&&y.push(m),w&&y.push(w),p&&y.push(p),d&&y.push(d);let x=e.compute(Hs(h,t,r,m,w,l,_,p,d),{inputs:y,outputs:h>1?[-1,1]:[-1]})[0];e.compute(js(x,l.batchSize,l.numHeads,_,l.sequenceLength,b,p,d),{inputs:p&&d?[x,p,d]:[x],outputs:[]});let S=[x,i];f&&M.size(f.dims)>0&&S.push(f),p&&S.push(p),d&&S.push(d),e.compute(Ks(h,x,i,f,l,_,p,d),{inputs:S,outputs:h>1?[0,2]:[0]})},Zs=(e,t)=>{let r=[t.batchSize,t.numHeads,t.sequenceLength,t.headSize],i=t.sequenceLength,a=t.inputHiddenSize,n=t.headSize,s=12,o={x:Math.ceil(t.headSize/s),y:Math.ceil(t.sequenceLength/s),z:t.batchSize*t.numHeads},u=[e.inputs[0],e.inputs[1],e.inputs[2]],l=[{type:12,data:i},{type:12,data:a},{type:12,data:n},{type:12,data:t.numHeads},{type:12,data:t.headSize},{type:12,data:t.hiddenSize},{type:12,data:t.hiddenSize+t.hiddenSize+t.vHiddenSize}],p=d=>{let h=q("output_q",u[0].dataType,r),m=q("output_k",u[0].dataType,r),f=q("output_v",u[0].dataType,r),_=O("input",u[0].dataType,u[0].dims),b=O("weight",u[1].dataType,u[1].dims),w=O("bias",u[2].dataType,u[2].dims),y=_.type.storage,x=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${s}u;
  var<workgroup> tileInput: array<${y}, ${s*s}>;
  var<workgroup> tileWeightQ: array<${y}, ${s*s}>;
  var<workgroup> tileWeightK: array<${y}, ${s*s}>;
  var<workgroup> tileWeightV: array<${y}, ${s*s}>;
  ${d.registerUniforms(x).declareVariables(_,b,w,h,m,f)}
  ${d.mainStart([s,s,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${y}(0);
    var valueK = ${y}(0);
    var valueV = ${y}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return e.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0},{dims:r,dataType:e.inputs[0].dataType,gpuDataType:0}],dispatchGroup:o,programUniforms:l}),getShaderSource:p},{inputs:u,outputs:[-1,-1,-1]})},Qs=(e,t)=>{let r=Ws(e.inputs,t),[i,a,n]=Zs(e,r);return ca(e,i,a,n,e.inputs[4],void 0,void 0,void 0,e.inputs[5],r)}}),Xs,Ys,Js,eo,kc=z(()=>{"use strict";Je(),le(),re(),$(),Q(),Xs=(e,t)=>{if(!e||e.length!==5)throw new Error("BatchNormalization requires 5 inputs");let r=(i,a,n)=>{let s=a.length;if(s!==i.length)throw new Error(`${n}: num dimensions != ${s}`);a.forEach((o,u)=>{if(o!==i[u])throw new Error(`${n}: dim[${u}] do not match`)})};if(e[0].dims.length>1){let i=t.format==="NHWC"?t.spatial?e[0].dims.slice(-1):e[0].dims.slice(-1).concat(e[0].dims.slice(1,e[0].dims.length-1)):e[0].dims.slice(1,t.spatial?2:void 0);r(e[1].dims,i,"Invalid input scale"),r(e[2].dims,i,"Invalid input B"),r(e[3].dims,i,"Invalid input mean"),r(e[4].dims,i,"Invalid input var")}else r(e[1].dims,[1],"Invalid input scale"),r(e[2].dims,[1],"Invalid input B"),r(e[3].dims,[1],"Invalid input mean"),r(e[4].dims,[1],"Invalid input var")},Ys=(e,t)=>{let{epsilon:r,spatial:i,format:a}=t,n=e[0].dims,s=i?R(n[n.length-1]):1,o=a==="NHWC"&&n.length>1?s:1,u=M.size(n)/s,l=i,p=l?n.length:n,d=O("x",e[0].dataType,e[0].dims,s),h=O("scale",e[1].dataType,e[1].dims,o),m=O("bias",e[2].dataType,e[2].dims,o),f=O("inputMean",e[3].dataType,e[3].dims,o),_=O("inputVar",e[4].dataType,e[4].dims,o),b=q("y",e[0].dataType,p,s),w=()=>{let x="";if(i)x=`let cOffset = ${n.length===1?"0u":a==="NHWC"?`outputIndices[${n.length-1}] / ${s}`:"outputIndices[1]"};`;else if(a==="NCHW")x=`
            ${b.indicesSet("outputIndices","0","0")}
            let cOffset = ${b.indicesToOffset("outputIndices")};`;else{x=`var cIndices = ${h.type.indices}(0);
                       cIndices[0] = outputIndices[${n.length-1}];`;for(let S=1;S<h.rank;S++)x+=`cIndices[${S}] = outputIndices[${S}];`;x+=`let cOffset = ${h.indicesToOffset("cIndices")};`}return x},y=x=>`
  const epsilon = ${r};
  ${x.registerUniform("outputSize","u32").declareVariables(d,h,m,f,_,b)}
  ${x.mainStart()}
  ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${b.offsetToIndices(`global_idx * ${s}`)};
    ${w()}
    let scale = ${h.getByOffset("cOffset")};
    let bias = ${m.getByOffset("cOffset")};
    let inputMean = ${f.getByOffset("cOffset")};
    let inputVar = ${_.getByOffset("cOffset")};
    let x = ${d.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${b.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${t.epsilon}_${t.format}_${i}_${s}`,inputDependencies:l?["rank","type","type","type","type"]:void 0},getShaderSource:y,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l?[{type:12,data:u},...I(n)]:[{type:12,data:u}]})}},Js=e=>g(e),eo=(e,t)=>{let{inputs:r,outputCount:i}=e,a=Js({...t,outputCount:i});if(te.webgpu.validateInputContent&&Xs(r,a),t.trainingMode)throw new Error("BatchNormalization trainingMode is not supported yet.");e.compute(Ys(r,a))}}),to,ro,io,Ic=z(()=>{"use strict";re(),Q(),to=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![320,640,1280].includes(e[0].dims[2]))throw new Error("number of channels should be 320, 640 or 1280");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},ro=e=>{let t=e[0].dims,r=e[0].dims[2],i=M.size(t)/4,a=e[0].dataType,n=O("input",a,t,4),s=O("bias",a,[r],4),o=O("residual",a,t,4),u=q("output",a,t,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(i/64)}}),getShaderSource:l=>`
  const channels = ${r}u / 4;
  ${l.declareVariables(n,s,o,u)}

  ${l.mainStart()}
    ${l.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let value = ${n.getByOffset("global_idx")}
      + ${s.getByOffset("global_idx % channels")} + ${o.getByOffset("global_idx")};
    ${u.setByOffset("global_idx","value")}
  }`}},io=e=>{to(e.inputs),e.compute(ro(e.inputs))}}),ao,ze,no,so,oo,uo,lo,po,co,ho,fo,mo,go,yo,_o,wo,ha,$o,Ma,bo,vo,xo,So,To,Eo,ko,Io,zo,Co,Oo,Ao,Ro,Bo,Mo,Do,Po,mn,Uo,gn,yn,No,Lo,Vo,Fo,qo,Go,_n=z(()=>{"use strict";le(),re(),$(),Q(),ao=(e,t,r,i,a,n,s)=>{let o=Math.ceil(t/4),u="";typeof a=="string"?u=`${a}(a)`:u=a("a");let l=O("inputData",r,[o],4),p=q("outputData",i,[o],4),d=[{name:"vec_size",type:"u32"}];return s&&d.push(...s),`
      ${e.registerUniforms(d).declareVariables(l,p)}

  ${n??""}

  ${e.mainStart()}
    ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${l.getByOffset("global_idx")};
    ${p.setByOffset("global_idx",u)}
  }`},ze=(e,t,r,i,a,n=e.dataType,s,o)=>{let u=[{type:12,data:Math.ceil(M.size(e.dims)/4)}];return s&&u.push(...s),{name:t,shaderCache:{hint:a,inputDependencies:["type"]},getShaderSource:l=>ao(l,M.size(e.dims),e.dataType,n,r,i,o),getRunData:l=>({outputs:[{dims:e.dims,dataType:n}],dispatchGroup:{x:Math.ceil(M.size(l[0].dims)/64/4)},programUniforms:u})}},no=e=>{e.compute(ze(e.inputs[0],"Abs","abs"))},so=e=>{e.compute(ze(e.inputs[0],"Acos","acos"))},oo=e=>{e.compute(ze(e.inputs[0],"Acosh","acosh"))},uo=e=>{e.compute(ze(e.inputs[0],"Asin","asin"))},lo=e=>{e.compute(ze(e.inputs[0],"Asinh","asinh"))},po=e=>{e.compute(ze(e.inputs[0],"Atan","atan"))},co=e=>{e.compute(ze(e.inputs[0],"Atanh","atanh"))},ho=e=>g(e),fo=(e,t)=>{let r;switch(t.to){case 10:r="vec4<f16>";break;case 1:r="vec4<f32>";break;case 12:r="vec4<u32>";break;case 6:r="vec4<i32>";break;case 9:r="vec4<bool>";break;default:throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${t.to}`)}e.compute(ze(e.inputs[0],"Cast",r,void 0,t.cacheKey,t.to))},mo=e=>{let t,r,i=e.length>=2&&e[1].data!==0,a=e.length>=3&&e[2].data!==0;switch(e[0].dataType){case 1:t=i?e[1].getFloat32Array()[0]:-34028234663852886e22,r=a?e[2].getFloat32Array()[0]:34028234663852886e22;break;case 10:t=i?e[1].getUint16Array()[0]:64511,r=a?e[2].getUint16Array()[0]:31743;break;default:throw new Error("Unsupport data type")}return g({min:t,max:r})},go=(e,t)=>{let r=t||mo(e.inputs),i=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"Clip",a=>`clamp(${a}, vec4<${i}>(uniforms.min), vec4<${i}>(uniforms.max))`,void 0,r.cacheKey,void 0,[{type:e.inputs[0].dataType,data:r.min},{type:e.inputs[0].dataType,data:r.max}],[{name:"min",type:i},{name:"max",type:i}]),{inputs:[0]})},yo=e=>{e.compute(ze(e.inputs[0],"Ceil","ceil"))},_o=e=>{e.compute(ze(e.inputs[0],"Cos","cos"))},wo=e=>{e.compute(ze(e.inputs[0],"Cosh","cosh"))},ha=e=>g(e),$o=(e,t)=>{let r=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"Elu",i=>`elu_vf32(${i})`,`
  const elu_alpha_ = ${r}(${t.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,t.cacheKey))},Ma=(e="f32")=>`
const r0: ${e} = 0.3275911;
const r1: ${e} = 0.254829592;
const r2: ${e} = -0.284496736;
const r3: ${e} = 1.421413741;
const r4: ${e} = -1.453152027;
const r5: ${e} = 1.061405429;

fn erf_vf32(v: vec4<${e}>) -> vec4<${e}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,bo=e=>{let t=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"Erf",r=>`erf_vf32(${r})`,Ma(t)))},vo=e=>{e.compute(ze(e.inputs[0],"Exp","exp"))},xo=e=>{e.compute(ze(e.inputs[0],"Floor","floor"))},So=e=>{let t=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"Gelu",r=>`0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`,Ma(t)))},To=(e,t)=>{let r=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"LeakyRelu",i=>`select(leaky_relu_alpha_ * ${i}, ${i}, ${i} >= vec4<${r}>(0.0))`,`const leaky_relu_alpha_ = ${r}(${t.alpha});`,t.cacheKey))},Eo=e=>{e.compute(ze(e.inputs[0],"Not",t=>`!${t}`))},ko=e=>{e.compute(ze(e.inputs[0],"Neg",t=>`-${t}`))},Io=e=>{e.compute(ze(e.inputs[0],"Reciprocal",t=>`1.0/${t}`))},zo=e=>{let t=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"Relu",r=>`select(vec4<${t}>(0.0), ${r}, ${r} > vec4<${t}>(0.0))`))},Co=e=>{e.compute(ze(e.inputs[0],"Sigmoid",t=>`(1.0 / (1.0 + exp(-${t})))`))},Oo=e=>g(e),Ao=(e,t)=>{let r=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"HardSigmoid",i=>`max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${t.alpha} * ${i} + vec4<${r}>(${t.beta})))`,void 0,t.cacheKey))},Ro=e=>{let t=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"HardSwish",r=>`${r} * max(vec4<${t}>(0.0), min(vec4<${t}>(1.0), vec4<${t}>(${t}(1.0 / 6.0)) * ${r} + vec4<${t}>(0.5)))`))},Bo=e=>{e.compute(ze(e.inputs[0],"Sin","sin"))},Mo=e=>{e.compute(ze(e.inputs[0],"Sinh","sinh"))},Do=e=>{e.compute(ze(e.inputs[0],"Sqrt","sqrt"))},Po=e=>{e.compute(ze(e.inputs[0],"Tan","tan"))},mn=e=>`sign(${e}) * (1 - exp(-2 * abs(${e}))) / (1 + exp(-2 * abs(${e})))`,Uo=e=>{e.compute(ze(e.inputs[0],"Tanh",mn))},gn=(e="f32")=>`
const fast_gelu_a: ${e} = 0.5;
const fast_gelu_b: ${e} = 0.7978845608028654;
const fast_gelu_c: ${e} = 0.035677408136300125;

fn tanh_v(v: vec4<${e}>) -> vec4<${e}> {
  return ${mn("v")};
}
`,yn=e=>`(fast_gelu_a + fast_gelu_a * tanh_v(${e} * (fast_gelu_c * ${e} * ${e} + fast_gelu_b))) * ${e}`,No=e=>{let t=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"FastGelu",yn,gn(t),void 0,e.inputs[0].dataType))},Lo=(e,t)=>{let r=k(e.inputs[0].dataType);return e.compute(ze(e.inputs[0],"ThresholdedRelu",i=>`select(vec4<${r}>(0.0), ${i}, ${i} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${r}>(${t.alpha});`,t.cacheKey)),0},Vo=e=>{e.compute(ze(e.inputs[0],"Log","log"))},Fo=(e,t)=>`
const alpha = vec4<${e}>(${t});
const one = ${e}(1.0);
const zero = ${e}(0.0);

fn quick_gelu_impl(x: vec4<${e}>) -> vec4<${e}> {
  let v = x *alpha;
  var x1 : vec4<${e}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,qo=e=>`quick_gelu_impl(${e})`,Go=(e,t)=>{let r=k(e.inputs[0].dataType);e.compute(ze(e.inputs[0],"QuickGelu",qo,Fo(r,t.alpha),t.cacheKey,e.inputs[0].dataType))}}),Wo,jo,Ho,zc=z(()=>{"use strict";re(),Q(),_n(),Wo=e=>{if(e[0].dims.length!==3)throw new Error("input should have 3 dimensions");if(![2560,5120,10240].includes(e[0].dims[2]))throw new Error("hidden state should be 2560, 5120 or 10240");if(e[1].dims.length!==1)throw new Error("bias is expected to have 1 dimensions");if(e[0].dims[2]!==e[1].dims[0])throw new Error("last dimension of input and bias are not the same")},jo=e=>{let t=e[0].dims.slice();t[2]=t[2]/2;let r=O("input",e[0].dataType,e[0].dims,4),i=O("bias",e[0].dataType,[e[0].dims[2]],4),a=q("output",e[0].dataType,t,4),n=M.size(t)/4,s=A(e[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:t,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)}}),getShaderSource:o=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${e[0].dims[2]/4/2}u;

  ${o.declareVariables(r,i,a)}

  ${Ma(s)}

  ${o.mainStart()}
    ${o.guardAgainstOutOfBoundsWorkgroupSizes(n)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${a.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},Ho=e=>{Wo(e.inputs),e.compute(jo(e.inputs))}}),Ko,Zo,jt,Qo,Xo,Yo,Jo,eu,tu,ru,iu,au,nu,Cc=z(()=>{"use strict";le(),re(),Q(),Ko=(e,t,r,i,a,n,s,o,u,l,p,d)=>{let h,m;typeof o=="string"?h=m=(y,x)=>`${o}((${y}),(${x}))`:typeof o=="function"?h=m=o:(h=o.scalar,m=o.vector);let f=q("outputData",p,i.length,4),_=O("aData",u,t.length,4),b=O("bData",l,r.length,4),w;if(a)if(n){let y=M.size(t)===1,x=M.size(r)===1,S=t.length>0&&t[t.length-1]%4===0,E=r.length>0&&r[r.length-1]%4===0;y||x?w=f.setByOffset("global_idx",m(y?`${_.type.value}(${_.getByOffset("0")}.x)`:_.getByOffset("global_idx"),x?`${b.type.value}(${b.getByOffset("0")}.x)`:b.getByOffset("global_idx"))):w=`
            let outputIndices = ${f.offsetToIndices("global_idx * 4u")};
            let offsetA = ${_.broadcastedIndicesToOffset("outputIndices",f)};
            let offsetB = ${b.broadcastedIndicesToOffset("outputIndices",f)};
            ${f.setByOffset("global_idx",m(s||S?_.getByOffset("offsetA / 4u"):`${_.type.value}(${_.getByOffset("offsetA / 4u")}[offsetA % 4u])`,s||E?b.getByOffset("offsetB / 4u"):`${b.type.value}(${b.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else w=f.setByOffset("global_idx",m(_.getByOffset("global_idx"),b.getByOffset("global_idx")));else{if(!n)throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");let y=(x,S,E="")=>{let C=`aData[indexA${S}][componentA${S}]`,B=`bData[indexB${S}][componentB${S}]`;return`
            let outputIndices${S} = ${f.offsetToIndices(`global_idx * 4u + ${S}u`)};
            let offsetA${S} = ${_.broadcastedIndicesToOffset(`outputIndices${S}`,f)};
            let offsetB${S} = ${b.broadcastedIndicesToOffset(`outputIndices${S}`,f)};
            let indexA${S} = offsetA${S} / 4u;
            let indexB${S} = offsetB${S} / 4u;
            let componentA${S} = offsetA${S} % 4u;
            let componentB${S} = offsetB${S} % 4u;
            ${x}[${S}] = ${E}(${h(C,B)});
          `};p===9?w=`
            var data = vec4<u32>(0);
            ${y("data",0,"u32")}
            ${y("data",1,"u32")}
            ${y("data",2,"u32")}
            ${y("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:w=`
            ${y("outputData[global_idx]",0)}
            ${y("outputData[global_idx]",1)}
            ${y("outputData[global_idx]",2)}
            ${y("outputData[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(_,b,f)}

        ${d??""}

        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${w}
      }`},Zo=(e,t,r,i,a,n,s=r.dataType)=>{let o=r.dims.map(Number),u=i.dims.map(Number),l=!M.areEqual(o,u),p=o,d=M.size(o),h=!1,m=!1,f=[l];if(l){let _=Xt.calcShape(o,u,!1);if(!_)throw new Error("Can't perform binary op on the given tensors");p=_.slice(),d=M.size(p);let b=M.size(o)===1,w=M.size(u)===1,y=o.length>0&&o[o.length-1]%4===0,x=u.length>0&&u[u.length-1]%4===0;f.push(b),f.push(w),f.push(y),f.push(x);let S=1;for(let E=1;E<p.length;E++){let C=o[o.length-E],B=u[u.length-E];if(C===B)S*=C;else break}S%4===0?(m=!0,h=!0):(b||w||y||x)&&(h=!0)}else h=!0;return f.push(h),{name:e,shaderCache:{hint:t+f.map(_=>_.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:_=>Ko(_,o,u,p,h,l,m,a,r.dataType,i.dataType,s,n),getRunData:()=>({outputs:[{dims:p,dataType:s}],dispatchGroup:{x:Math.ceil(d/64/4)},programUniforms:[{type:12,data:Math.ceil(M.size(p)/4)},...I(o,u,p)]})}},jt=(e,t,r,i,a,n)=>{e.compute(Zo(t,a??"",e.inputs[0],e.inputs[1],r,i,n))},Qo=e=>{jt(e,"Add",(t,r)=>`${t}+${r}`)},Xo=e=>{jt(e,"Div",(t,r)=>`${t}/${r}`)},Yo=e=>{jt(e,"Equal",{scalar:(t,r)=>`u32(${t}==${r})`,vector:(t,r)=>`vec4<u32>(${t}==${r})`},void 0,void 0,9)},Jo=e=>{jt(e,"Mul",(t,r)=>`${t}*${r}`)},eu=e=>{let t=O("input",e.inputs[0].dataType,e.inputs[0].dims).type.value;jt(e,"Pow",{scalar:(r,i)=>`pow_custom(${r},${i})`,vector:(r,i)=>`pow_vector_custom(${r},${i})`},`
    fn pow_custom(a : ${t}, b : ${t}) -> ${t} {
      if (b == ${t}(0.0)) {
        return ${t}(1.0);
      } else if (a < ${t}(0.0) && f32(b) != floor(f32(b))) {
        return ${t}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${t}(1.0), round(f32(abs(b) % ${t}(2.0))) != 1.0) * ${t}(${t==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${t}>, b : vec4<${t}>) -> vec4<${t}> {
      // TODO: implement vectorized pow
      return vec4<${t}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},tu=e=>{jt(e,"Sub",(t,r)=>`${t}-${r}`)},ru=e=>{jt(e,"Greater",{scalar:(t,r)=>`u32(${t}>${r})`,vector:(t,r)=>`vec4<u32>(${t}>${r})`},void 0,void 0,9)},iu=e=>{jt(e,"Less",{scalar:(t,r)=>`u32(${t}<${r})`,vector:(t,r)=>`vec4<u32>(${t}<${r})`},void 0,void 0,9)},au=e=>{jt(e,"GreaterOrEqual",{scalar:(t,r)=>`u32(${t}>=${r})`,vector:(t,r)=>`vec4<u32>(${t}>=${r})`},void 0,void 0,9)},nu=e=>{jt(e,"LessOrEqual",{scalar:(t,r)=>`u32(${t}<=${r})`,vector:(t,r)=>`vec4<u32>(${t}<=${r})`},void 0,void 0,9)}}),su,ou,uu,lu,du,pu,Oc=z(()=>{"use strict";le(),re(),$(),Q(),su=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");let r=0,i=e[r],a=i.dataType,n=i.dims.length;e.forEach((s,o)=>{if(o!==r){if(s.dataType!==a)throw new Error("input tensors should be one type");if(s.dims.length!==n)throw new Error("input tensors should have the same shape");s.dims.forEach((u,l)=>{if(l!==t&&u!==i.dims[l])throw new Error("non concat dimensions must match")})}})},ou=(e,t)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${e}u>(${t});
    for (var i: u32 = 0u; i < ${e}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${e}u;
  }`,uu=(e,t)=>{let r=e.length,i=[];for(let a=0;a<r;++a){let n=t.setByOffset("global_idx",e[a].getByIndices("indices"));r===1?i.push(n):a===0?i.push(`if (inputIndex == ${a}u) { ${n} }`):a===r-1?i.push(`else { ${n} }`):i.push(`else if (inputIndex == ${a}) { ${n} }`)}return i.join(`
`)},lu=(e,t,r,i)=>{let a=M.size(r),n=new Array(e.length),s=new Array(e.length),o=0,u=[],l=[],p=[{type:12,data:a}];for(let _=0;_<e.length;++_)o+=e[_].dims[t],n[_]=o,l.push(e[_].dims.length),s[_]=O(`input${_}`,i,l[_]),u.push("rank"),p.push({type:12,data:n[_]});for(let _=0;_<e.length;++_)p.push(...I(e[_].dims));p.push(...I(r));let d=q("output",i,r.length),h=d.indicesGet("indices",t),m=Array.from(Array(n.length).keys()).map(_=>`uniforms.sizeInConcatAxis${_}`).join(","),f=_=>`

  ${(()=>{_.registerUniform("outputSize","u32");for(let b=0;b<e.length;b++)_.registerUniform(`sizeInConcatAxis${b}`,"u32");return _.declareVariables(...s,d)})()}

  ${ou(n.length,m)}

  ${_.mainStart()}
    ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${d.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${h});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${n.length}u>(${m});
      ${h} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${uu(s,d)}
  }`;return{name:"Concat",shaderCache:{hint:`${t}`,inputDependencies:u},getRunData:()=>({outputs:[{dims:r,dataType:i}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:p}),getShaderSource:f}},du=(e,t)=>{let r=e.inputs,i=r[0].dims,a=M.normalizeAxis(t.axis,i.length);su(r,a);let n=i.slice();n[a]=r.reduce((o,u)=>o+(u.dims.length>a?u.dims[a]:0),0);let s=r.filter(o=>M.size(o.dims)>0);e.compute(lu(s,a,n,r[0].dataType),{inputs:s})},pu=e=>g({axis:e.axis})}),Yr,Jr,ei,wn,ti=z(()=>{"use strict";le(),re(),Yr=(e,t,r="f32")=>{switch(e.activation){case"Relu":return`value = max(value, ${t}(0.0));`;case"Sigmoid":return`value = (${t}(1.0) / (${t}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${t}(${r}(uniforms.clip_min)), ${t}(${r}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${t}(0.0), min(${t}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${r}(uniforms.alpha) * value, value, value >= ${t}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw new Error(`Unsupported activation ${e.activation}`)}},Jr=(e,t)=>{e.activation==="Clip"?t.push({type:1,data:e.clipMax},{type:1,data:e.clipMin}):e.activation==="HardSigmoid"?t.push({type:1,data:e.alpha},{type:1,data:e.beta}):e.activation==="LeakyRelu"&&t.push({type:1,data:e.alpha})},ei=(e,t)=>{e.activation==="Clip"?t.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):e.activation==="HardSigmoid"?t.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):e.activation==="LeakyRelu"&&t.push({name:"alpha",type:"f32"})},wn=e=>{let t=(e==null?void 0:e.activation)||"";if(t==="HardSigmoid"){let[r,i]=(e==null?void 0:e.activation_params)||[.2,.5];return{activation:t,alpha:r,beta:i}}else if(t==="Clip"){let[r,i]=(e==null?void 0:e.activation_params)||[ea,Pt];return{activation:t,clipMax:i,clipMin:r}}else if(t==="LeakyRelu"){let[r]=(e==null?void 0:e.activation_params)||[.01];return{activation:t,alpha:r}}return{activation:t}}}),nt,cu,$n=z(()=>{"use strict";nt=(e,t)=>{switch(e){case 1:return t;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw new Error(`${e}-component is not supported.`)}},cu=e=>`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      `}),hu,Ac=z(()=>{"use strict";hu=e=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${e}.x), i32(${e}.y), i32(${e}.z), 1));
}
`}),fa,bn,vn=z(()=>{"use strict";le(),re(),Q(),ti(),fa=(e,t,r,i,a)=>{let n=i-r;return`
      ${Array.from({length:r}).map((s,o)=>`
      if (${D(t.shape,o,t.rank)} != 1) {
        ${t.indicesSet(e,o,D(a,o+n,i))}
      } else {
        ${t.indicesSet(e,o,0)}
      }`).join("")}
`},bn=(e,t,r,i,a=!1,n)=>{let s=e[0].dims,o=e[1].dims,u=s[s.length-2],l=o[o.length-1],p=s[s.length-1],d=R(l),h=R(p),m=R(u),f=M.size(r)/d/m,_=e.length>2,b=i?i.slice(0,-2):r.slice(0,-2),w=[M.size(b),u,l],y=[{type:12,data:f},{type:12,data:u},{type:12,data:l},{type:12,data:p}];Jr(t,y),y.push(...I(b,s,o)),_&&y.push(...I(e[2].dims)),y.push(...I(w));let x=S=>{let E=me("batch_dims",e[0].dataType,b.length),C=O("a",e[0].dataType,s.length,h),B=O("b",e[1].dataType,o.length,d),P=q("output",e[0].dataType,w.length,d),L=A(P.type.tensor),W=Yr(t,P.type.value,L),oe=[C,B],X="";if(_){let ke=a?d:1;oe.push(O("bias",e[2].dataType,e[2].dims.length,ke)),X=`${a?`value += bias[col / ${ke}];`:`value += ${P.type.value}(bias[row + i]);`}`}let ee=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];ei(t,ee);let Ee=()=>{let ke=`var a_data: ${C.type.value};`;for(let ae=0;ae<h;ae++)ke+=`
              let b_data${ae} = b[(b_offset + (k + ${ae}) * uniforms.N + col) / ${d}];`;for(let ae=0;ae<m;ae++){ke+=`a_data = a[(a_offset + (row + ${ae}) * uniforms.K + k) / ${h}];`;for(let ce=0;ce<h;ce++)ke+=`
            values[${ae}] = fma(${B.type.value}(a_data${h===1?"":`[${ce}]`}), b_data${ce}, values[${ae}]);
`}return ke};return`
  ${S.registerUniforms(ee).registerInternalVariables(E).declareVariables(...oe,P)}
  ${S.mainStart()}
    ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${d})) * ${d};
    var index1 = global_idx / (uniforms.N / ${d});
    let stride1 = uniforms.M / ${m};
    let row = (index1 % stride1) * ${m};
    let batch = index1 / stride1;

    ${r.length===2?"":`let batch_indices = ${E.offsetToIndices("batch")};`}

    var a_indices: ${C.type.indices};
    ${fa("a_indices",C,C.rank-2,E.rank,"batch_indices")}
    ${C.indicesSet("a_indices",C.rank-2,0)}
    ${C.indicesSet("a_indices",C.rank-1,0)}
    let a_offset = ${C.indicesToOffset("a_indices")};

    var b_indices: ${B.type.indices};
    ${fa("b_indices",B,B.rank-2,E.rank,"batch_indices")}
    ${B.indicesSet("b_indices",B.rank-2,0)}
    ${B.indicesSet("b_indices",B.rank-1,0)}
    let b_offset = ${B.indicesToOffset("b_indices")};
    var values: array<${P.type.value}, ${m}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${h}) {
      ${Ee()}
    }
    for (var i = 0u; i < ${m}u; i++) {
      var value = values[i];
      ${X}
      ${W}
      let cur_indices = ${P.type.indices}(batch, row + i, col);
      let offset = ${P.indicesToOffset("cur_indices")};
      ${P.setByOffset(`offset / ${d}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${t.activation};${d};${h};${m};${a}`,inputDependencies:_?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(f/64)},programUniforms:y}),getShaderSource:x}}}),fu,mu,xn,Sn,gu,Tn,yu,Da,En=z(()=>{"use strict";le(),re(),Q(),ti(),vn(),$n(),fu=(e,t)=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${t?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${t?", batchIndices":""});
        `,mu=(e,t)=>e?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${t===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${t===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,xn=(e,t,r="f32",i,a=!1,n=32,s=!1,o=32)=>{let u=t[1]*e[1],l=t[0]*e[0],p=a?u:n,d=a?n:u,h=p/t[0],m=n/t[1];if(!((a&&h===4&&e[1]===4||!a&&(h===3||h===4))&&p%t[0]===0&&n%t[1]===0&&e[0]===4))throw new Error(`If transposeA ${a} is true, innerElementSize ${h} and workPerThread[1] ${e[1]} must be 4.
      Otherwise, innerElementSize ${h} must be 3 or 4.
  tileAWidth ${p} must be divisible by workgroupSize[0]${t[0]}. tileInner ${n} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${h}<${r}>, ${p/h}>, ${d}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${l/e[0]}>, ${n}>;

const rowPerThread = ${e[1]};
const colPerThread = ${e[0]};
const innerElementSize = ${h};
const tileInner = ${n};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${s?"0":"i32(globalId.z)"};
  ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${u};

  let num_tiles = ${s?`${Math.ceil(o/n)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${m};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${fu(a,i)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${m}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${i?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${h===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${mu(a,h)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},Sn=(e,t)=>e?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${t?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${t?", batchIndices":""});
            `,gu=e=>e?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",Tn=(e,t,r="f32",i,a=!1,n=32,s=!1,o=32,u=!1)=>{let l=e[1]*t[1],p=e[0]*t[0],d=a?l:n,h=a?n:l;if(!(h%t[1]===0&&d%t[0]===0&&n%t[1]===0))throw new Error(`tileAHight ${h} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${d} must be divisible by workgroupSize[0]${t[0]}, tileInner ${n} must be divisible by workgroupSize[1]${t[1]}`);let m=h/t[1],f=d/t[0],_=n/t[1],b=u?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${l};
    let globalColStart = i32(workgroupId.x) * ${p};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${h}; inputRow = inputRow + ${t[1]}) {
        for (var inputCol = localCol; inputCol < ${d}; inputCol = inputCol + ${t[0]}) {
          ${Sn(a,i)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${n}; inputRow = inputRow + ${t[1]}) {
            for (var inputCol = localCol; inputCol < ${p}; inputCol = inputCol + ${t[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${i?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${a?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${t[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${t[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${l};

let tileRowA = i32(localId.y) * ${m};
let tileColA = i32(localId.x) * ${f};
let tileRowB = i32(localId.y) * ${_};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${m}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${f}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${Sn(a,i)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${_}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${i?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${gu(a)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${r}, ${d}>, ${h}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${p}>, ${n}>;
  const rowPerThread = ${e[1]};
  const colPerThread = ${e[0]};
  const tileInner = ${n};

@compute @workgroup_size(${t[0]}, ${t[1]}, ${t[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${s?"0":"i32(globalId.z)"};
    ${i?`let batchIndices = ${i.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${s?`${Math.ceil(o/n)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${s?`i32(globalId.z) * ${o}`:"0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${b}
  }
`},yu=(e,t,r,i,a=!1)=>{let[n,s,o,u]=i,l=A(i[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${n.type.indices}) -> ${nt(e,l)} {
      var value = ${nt(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${s.type.indices};
        ${fa("aIndices",s,s.rank-2,n.rank,"batchIndices")}
        ${s.indicesSet("aIndices",s.rank-2,"u32(row)")}
        ${s.indicesSet("aIndices",s.rank-1,"u32(colIn)")}
        value = ${s.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${n.type.indices}) -> ${nt(e,l)} {
      var value = ${nt(e,l)}(0.0);
      let col = colIn * ${e};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${o.type.indices};
        ${fa("bIndices",o,o.rank-2,n.rank,"batchIndices")}
        ${o.indicesSet("bIndices",o.rank-2,"u32(row)")}
        ${o.indicesSet("bIndices",o.rank-1,"u32(colIn)")}
        value = ${o.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${nt(e,l)}) {
      let col = colIn * ${e};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${t?`value = value + ${a?"bias[colIn]":`${nt(e,l)}(bias[row])`};`:""}
        ${r}
        ${u.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},Da=(e,t,r,i,a=!1,n)=>{let s=e[0].dims,o=e[1].dims,u=s.slice(0,-2),l=o.slice(0,-2),p=i?i.slice(0,-2):r.slice(0,-2),d=M.size(p),h=s[s.length-2],m=s[s.length-1],f=o[o.length-1],_=m%4===0&&f%4===0,b=h<=8?[4,1,1]:[4,4,1],w=[8,8,1],y=[Math.ceil(f/w[0]/b[0]),Math.ceil(h/w[1]/b[1]),Math.ceil(d/w[2]/b[2])],x=_?4:1,S=[...u,h,m/x],E=S.length,C=[...l,m,f/x],B=C.length,P=[d,h,f/x],L=[{type:6,data:h},{type:6,data:f},{type:6,data:m}];Jr(t,L),L.push(...I(p,S,C));let W=["rank","rank"],oe=e.length>2;oe&&(L.push(...I(e[2].dims)),W.push("rank")),L.push(...I(P));let X=ee=>{let Ee=p.length,ke=me("batchDims",e[0].dataType,Ee,1),ae=A(e[0].dataType),ce=O("a",e[0].dataType,E,x),Qe=O("b",e[1].dataType,B,x),j=q("result",e[0].dataType,P.length,x),Ce=[ce,Qe];if(oe){let Re=a?x:1;Ce.push(O("bias",e[2].dataType,e[2].dims.length,Re))}let G=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];ei(t,G);let K=A(j.type.tensor),J=Yr(t,j.type.value,K),H=yu(x,oe,J,[ke,ce,Qe,j],a);return`
  ${ee.registerUniforms(G).registerInternalVariables(ke).declareVariables(...Ce,j)}
  ${H}
  ${_?xn(b,w,ae,ke):Tn(b,w,ae,ke)}
                   `};return{name:"MatMul",shaderCache:{hint:`${b};${t.activation};${_};${a}`,inputDependencies:W},getRunData:()=>({outputs:[{dims:n?n(r):r,dataType:e[0].dataType}],dispatchGroup:{x:y[0],y:y[1],z:y[2]},programUniforms:L}),getShaderSource:X}}}),_u,wu,Rc=z(()=>{"use strict";le(),Tt(),Q(),ti(),$n(),Ac(),En(),_u=(e,t,r,i,a=!1,n,s=4,o=4,u=4,l="f32")=>{let p=L=>{switch(L){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${l}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw new Error(`innerElementSize ${L} is not supported.`)}},d=L=>{switch(L){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw new Error(`innerElementSize ${L} is not supported.`)}},h=e?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,m=e?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,f=e?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",_=e?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",b=e?"row":"col",w=e?"col":"row",y=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${b} / outWidth;
    let outCol = ${b} % outWidth;

    let WRow = ${w} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${w} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${w} % inChannels;
    var resData = ${nt(s,l)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${f} && xCol >= 0 && xCol < ${_}) {
      ${h}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${p(s)}
    }
    return resData;`,x=e?t&&i?`
    let col = colIn * ${s};
    ${y}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${y}
    }
    return ${nt(s,l)}(0.0);`:i&&r?`
    let col = colIn * ${s};
    ${y}`:`
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${y}
    }
    return ${nt(s,l)}(0.0);`,S=e?i&&r?d(o):`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${d(o)}
    }
    return ${nt(o,l)}(0.0);`:`
    let col = colIn * ${o};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${d(o)}
    }
    return ${nt(o,l)}(0.0);`,E=nt(u,l),C=nt(e?s:o,l),B=nt(e?o:s,l),P=Yr(n,E,l);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${C} {
      ${e?x:S}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${B} {
      ${e?S:x}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${E}) {
      let col = colIn * ${u};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${e?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${m}
      ${cu(a)}
      ${P}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},wu=(e,t,r,i,a,n,s,o,u)=>{let l=t.format==="NHWC",p=l?e[0].dims[3]:e[0].dims[1],d=r[0],h=l?r[2]:r[3],m=l?r[1]:r[2],f=l?r[3]:r[1],_=l&&(p%4===0||p%3===0)&&f%4===0,b=l?f:h*m,w=l?h*m:f,y=[8,8,1],x=i<=8?[4,1,1]:[4,4,1],S=[Math.ceil(b/y[0]/x[0]),Math.ceil(w/y[1]/x[1]),Math.ceil(d/y[2]/x[2])];Se("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${S}`);let E=_?l&&p%4!==0?3:4:1,C=y[1]*x[1],B=y[0]*x[0],P=Math.max(y[0]*E,y[1]),L=i%C===0,W=a%B===0,oe=n%P===0,X=_?[E,4,4]:[1,1,1],ee=[{type:6,data:i},{type:6,data:a},{type:6,data:n},{type:6,data:[t.pads[0],t.pads[1]]},{type:6,data:t.strides},{type:6,data:t.dilations}];Jr(t,ee),ee.push(...I(e[0].dims,e[1].dims));let Ee=["rank","rank"];s&&(ee.push(...I(e[2].dims)),Ee.push("rank")),ee.push(...I(r));let ke=ae=>{let ce=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];ei(t,ce);let Qe=_?4:1,j=A(e[0].dataType),Ce=`
      fn setOutputAtIndex(flatIndex : i32, value : ${_?`vec4<${j}>`:j}) {
        result[flatIndex] = ${_?`vec4<${j}>`:j}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${_?`vec4<${j}>`:j}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${_?"/ 4":""}, value);
      }`,G=O("x",e[0].dataType,e[0].dims.length,E===3?1:E),K=O("w",e[1].dataType,e[1].dims.length,Qe),J=[G,K],H=q("result",e[0].dataType,r.length,Qe);if(s){let Re=O("bias",e[2].dataType,e[2].dims.length,Qe);J.push(Re),Ce+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${_?`vec4<${j}>`:j} {
          return bias[coords.${l?"w":"y"}${_?"/ 4":""}];
        }`}return`
        ${hu("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${ae.registerUniforms(ce).declareVariables(...J,H)}
        ${Ce}
        ${_u(l,L,W,oe,s,t,X[0],X[1],X[2],j)}
        ${_?xn(x,y,j,void 0,!l,P):Tn(x,y,j,void 0,!l,P,!1,void 0,o)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${t.cacheKey};${E};${_};${L};${W};${oe};${C};${B};${P}`,inputDependencies:Ee},getRunData:()=>({outputs:[{dims:u?u(r):r,dataType:e[0].dataType}],dispatchGroup:{x:S[0],y:S[1],z:S[2]},programUniforms:ee}),getShaderSource:ke}}}),$u,kn,ma,bu,In,vu,xu,Su,Bc=z(()=>{"use strict";le(),Tt(),re(),Q(),ti(),$n(),$u=e=>{let t=1;for(let r=0;r<e.length;r++)t*=e[r];return t},kn=e=>typeof e=="number"?[e,e,e]:e,ma=(e,t)=>t<=1?e:e+(e-1)*(t-1),bu=(e,t,r,i=1)=>{let a=ma(t,i);return Math.floor((e[0]*(r-1)-r+a)/2)},In=(e,t,r,i,a)=>{a==null&&(a=bu(e,t[0],i[0]));let n=[0,0,0,r];for(let s=0;s<3;s++)e[s]+2*a>=t[s]&&(n[s]=Math.trunc((e[s]-t[s]+2*a)/i[s]+1));return n},vu=(e,t,r,i,a,n,s,o,u,l)=>{let p,d,h,m;if(e==="VALID"&&(e=0),typeof e=="number"){p={top:e,bottom:e,left:e,right:e,front:e,back:e};let f=In([t,r,i,1],[o,u,l],1,[a,n,s],e);d=f[0],h=f[1],m=f[2]}else if(Array.isArray(e)){if(!e.every((_,b,w)=>_===w[0]))throw Error(`Unsupported padding parameter: ${e}`);p={top:e[0],bottom:e[1],left:e[2],right:e[3],front:e[4],back:e[5]};let f=In([t,r,i,1],[o,u,l],1,[a,n,s],e[0]);d=f[0],h=f[1],m=f[2]}else if(e==="SAME_UPPER"){d=Math.ceil(t/a),h=Math.ceil(r/n),m=Math.ceil(i/s);let f=(d-1)*a+o-t,_=(h-1)*n+u-r,b=(m-1)*s+l-i,w=Math.floor(f/2),y=f-w,x=Math.floor(_/2),S=_-x,E=Math.floor(b/2),C=b-E;p={top:x,bottom:S,left:E,right:C,front:w,back:y}}else throw Error(`Unknown padding parameter: ${e}`);return{padInfo:p,outDepth:d,outHeight:h,outWidth:m}},xu=(e,t,r,i,a,n=!1,s="channelsLast")=>{let o,u,l,p,d;if(s==="channelsLast")[o,u,l,p,d]=e;else if(s==="channelsFirst")[o,d,u,l,p]=e;else throw new Error(`Unknown dataFormat ${s}`);let[h,,m,f,_]=t,[b,w,y]=kn(r),[x,S,E]=kn(i),C=ma(m,x),B=ma(f,S),P=ma(_,E),{padInfo:L,outDepth:W,outHeight:oe,outWidth:X}=vu(a,u,l,p,b,w,y,C,B,P),ee=n?h*d:h,Ee=[0,0,0,0,0];return s==="channelsFirst"?Ee=[o,ee,W,oe,X]:s==="channelsLast"&&(Ee=[o,W,oe,X,ee]),{batchSize:o,dataFormat:s,inDepth:u,inHeight:l,inWidth:p,inChannels:d,outDepth:W,outHeight:oe,outWidth:X,outChannels:ee,padInfo:L,strideDepth:b,strideHeight:w,strideWidth:y,filterDepth:m,filterHeight:f,filterWidth:_,effectiveFilterDepth:C,effectiveFilterHeight:B,effectiveFilterWidth:P,dilationDepth:x,dilationHeight:S,dilationWidth:E,inShape:e,outShape:Ee,filterShape:t}},Su=(e,t,r,i,a,n)=>{let s=n==="channelsLast",o=s?e[0].dims[3]:e[0].dims[1],u=!1,l=[64,1,1],p={x:r.map((y,x)=>x)},d=[Math.ceil($u(p.x.map(y=>r[y]))/l[0]),1,1];Se("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${d}`);let h=u?s&&o%4!==0?3:4:1,m=M.size(r),f=[{type:12,data:m},{type:12,data:i},{type:12,data:a},{type:12,data:t.strides},{type:12,data:t.dilations}];Jr(t,f),f.push(...I(e[0].dims,e[1].dims));let _=["rank","rank"],b=e.length===3;b&&(f.push(...I(e[2].dims)),_.push("rank")),f.push(...I(r));let w=y=>{let x=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:i.length},{name:"pads",type:"u32",length:a.length},{name:"strides",type:"u32",length:t.strides.length},{name:"dilations",type:"u32",length:t.dilations.length}];ei(t,x);let S=u?4:1,E=A(e[0].dataType),C=O("x",e[0].dataType,e[0].dims.length,h===3?1:h),B=O("W",e[1].dataType,e[1].dims.length,S),P=[C,B],L=q("result",e[0].dataType,r.length,S),W="";if(b){let ee=O("bias",e[2].dataType,e[2].dims.length,S);P.push(ee),W+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${u?`vec4<${E}>`:E} {
          return bias[${s?D("coords",4,5):D("coords",1,5)}${u?"/ 4":""}];
        }`}let oe=nt(h,E),X=Yr(t,oe,E);return`
            ${W}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${E} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${C.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> ${E} {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${B.getByIndices("aIndices")};
            }
          ${y.registerUniforms(x).declareVariables(...P,L)}
          ${y.mainStart()}
          ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${L.offsetToIndices("global_idx")};
              let batch = ${D("coords",0,C.rank)};
              let d2 = ${s?D("coords",C.rank-1,C.rank):D("coords",1,C.rank)};
              let xFRCCorner = vec3<u32>(${s?D("coords",1,C.rank):D("coords",2,C.rank)},
              ${s?D("coords",2,C.rank):D("coords",3,C.rank)},
              ${s?D("coords",3,C.rank):D("coords",4,C.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${s?D("uniforms.x_shape",1,C.rank):D("uniforms.x_shape",2,C.rank)};
              let xShapeZ = ${s?D("uniforms.x_shape",2,C.rank):D("uniforms.x_shape",3,C.rank)};
              let xShapeW = ${s?D("uniforms.x_shape",3,C.rank):D("uniforms.x_shape",4,C.rank)};
              let xShapeU = ${s?D("uniforms.x_shape",4,C.rank):D("uniforms.x_shape",1,C.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = ${E}(0);
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${s?`let xValues = vec4<${E}>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<${E}>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<${E}>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${s?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${s?`let xValues = vec2<${E}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<${E}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<${E}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${s?`let xValues = vec3<${E}>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<${E}>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<${E}>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${b?"value = value + getBiasByOutputCoords(coords)":""};
              ${X}
              result[global_idx] = ${E}(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${t.cacheKey};${s};${h};${b}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:d[0],y:d[1],z:d[2]},programUniforms:f}),getShaderSource:w}}}),Tu,Eu,Mc=z(()=>{"use strict";le(),re(),Q(),ti(),Tu=(e,t,r,i)=>{let a=e.length>2,n=a?"value += b[output_channel];":"",s=e[0].dims,o=e[1].dims,u=t.format==="NHWC",l=u?r[3]:r[1],p=l/t.group,d=u&&p>=4?R(l):1,h=M.size(r)/d,m=[{type:12,data:h},{type:12,data:t.dilations},{type:12,data:[t.strides[0],t.strides[1]]},{type:12,data:[t.pads[0],t.pads[1]]},{type:12,data:p}];Jr(t,m),m.push(...I(s,[o[0],o[1],o[2],o[3]/d]));let f=a?["rank","rank","rank"]:["rank","rank"];m.push(...I([r[0],r[1],r[2],r[3]/d]));let _=b=>{let w=q("output",e[0].dataType,r.length,d),y=A(w.type.tensor),x=Yr(t,w.type.value,y),S=O("x",e[0].dataType,s.length),E=O("w",e[1].dataType,o.length,d),C=[S,E];a&&C.push(O("b",e[2].dataType,e[2].dims,d));let B=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:t.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];ei(t,B);let P=u?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${S.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${E.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${S.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${E.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${b.registerUniforms(B).declareVariables(...C,w)}

  ${b.mainStart()}
    ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${w.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${u?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${u?1:2}], outputIndices[${u?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${d} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${u?2:1}];

    var value: ${w.type.value} = ${w.type.value}(0);
    ${P}
    ${n}
    ${x}
    ${w.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${t.cacheKey}_${d}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:m}),getShaderSource:_}},Eu=(e,t,r,i)=>{let a=e.length>2,n=R(r[3]),s=R(r[2]),o=M.size(r)/n/s,u=[e[0].dims[0],e[0].dims[1],e[0].dims[2],e[0].dims[3]/n],l=[e[1].dims[0],e[1].dims[1],e[1].dims[2],e[1].dims[3]/n],p=[r[0],r[1],r[2],r[3]/n],d=[{type:12,data:o},{type:6,data:[t.strides[0],t.strides[1]]},{type:6,data:[t.pads[0],t.pads[1]]}];Jr(t,d),d.push(...I(u,l,p));let h=(s-1)*t.strides[1]+l[1],m=f=>{let _=q("output",e[0].dataType,p.length,n),b=A(_.type.tensor),w=Yr(t,_.type.value,b),y=O("x",e[0].dataType,u.length,n),x=O("w",e[1].dataType,l.length,n),S=[y,x];a&&S.push(O("b",e[2].dataType,e[2].dims,n));let E=a?"value += b[output_channel];":"",C=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return ei(t,C),`
  ${f.registerUniforms(C).declareVariables(...S,_)}
  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${s}u;
    let col = (index1 % width1) * ${s}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${y.type.value}, ${h}>;
    var values: array<${_.type.value}, ${s}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${l[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${h}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${y.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${y.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${l[1]}; w_width++) {
          let w_val = ${x.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${s}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${s}u; i++) {
      var value = values[i];
      ${E}
      ${w}
      ${_.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${t.cacheKey};${n};${s};${h};${l[0]};${l[1]}`,inputDependencies:a?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:i?i(r):r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:d}),getShaderSource:m}}}),ku,Pa,Iu,Ua,zn,Cn,zu,Cu,On,Dc=z(()=>{"use strict";re(),Rc(),Bc(),En(),Mc(),ti(),vn(),Nt(),ku=(e,t,r,i,a,n)=>{let s=e[0],o=e.slice(n?1:2,n?3:4),u=o.length,l=t[0],p=t.slice(2).map((h,m)=>h+(h-1)*(r[m]-1)),d=o.map((h,m)=>h+i[m]+i[m+u]).map((h,m)=>Math.floor((h-p[m]+a[m])/a[m]));return d.splice(0,0,s),d.splice(n?3:1,0,l),d},Pa=[2,3,1,0],Iu=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length>5)throw new Error("greater than 5D is not supported");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[1]*t.group;if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(e.length===3&&(e[2].dims.length!==1||e[1].dims[0]!==e[2].dims[0]))throw new Error("invalid bias");let a=e[0].dims.length-2;if(t.dilations.length!==a)throw new Error(`dilations should be ${a}D`);if(t.strides.length!==a)throw new Error(`strides should be ${a}D`);if(t.pads.length!==a*2)throw new Error(`pads should be ${a*2}D`);if(t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape")},Ua=(e,t)=>{let r=e.kernelShape.slice();r.length<t[1].dims.length-2&&r.push(...Array(t[1].dims.length-2-r.length).fill(0));for(let n=2;n<t[1].dims.length;++n)r[n-2]===0&&(r[n-2]=t[1].dims[n]);let i=e.pads.slice();pr.adjustPadsBasedOnAutoPad(t[0].dims,e.strides,e.dilations,r,i,e.format==="NHWC",e.autoPad);let a=Object.assign({},e);return Object.assign(a,{kernelShape:r,pads:i}),a},zn=e=>{let t=wn(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],a=e.dilations,n=e.group,s=e.kernel_shape,o=e.pads,u=e.strides,l=e.w_is_const();return{autoPad:i,format:r,dilations:a,group:n,kernelShape:s,pads:o,strides:u,wIsConst:l,...t,cacheKey:`${e.format};${t.activation};`}},Cn=(e,t,r,i)=>{let a=r.format==="NHWC",n=ku(t[0].dims,t[1].dims,r.dilations,r.pads,r.strides,a);if(r.group!==1){let C=[t[0]];if(a){let B=e.kernelCustomData.wT??e.compute(at(t[1],Pa),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=B),C.push(B)}else C.push(t[1]);t.length===3&&C.push(t[2]),!e.adapterInfo.isArchitecture("ampere")&&a&&t[1].dims[0]===r.group&&t[1].dims[1]===1&&r.dilations[0]===1&&r.dilations[1]===1?e.compute(Eu(C,r,n,i),{inputs:C}):e.compute(Tu(C,r,n,i),{inputs:C});return}let s=t.length===3,o=t[0].dims[a?1:2],u=t[0].dims[a?2:3],l=t[0].dims[a?3:1],p=t[1].dims[2],d=t[1].dims[3],h=n[a?1:2],m=n[a?2:3],f=n[a?3:1],_=a&&p===o&&d===u&&r.pads[0]===0&&r.pads[1]===0;if(_||p===1&&d===1&&r.dilations[0]===1&&r.dilations[1]===1&&r.strides[0]===1&&r.strides[1]===1&&r.pads[0]===0&&r.pads[1]===0){let C=n[0],B,P,L,W=[];if(a){let ee=e.kernelCustomData.wT??e.compute(at(t[1],Pa),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];if(r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=ee),_){let Ee=o*u*l;B=t[0].reshape([1,C,Ee]),P=ee.reshape([1,Ee,f]),L=[1,C,f]}else B=t[0].reshape([C,o*u,l]),P=ee.reshape([1,l,f]),L=[C,h*m,f];W.push(B),W.push(P)}else B=t[0].reshape([C,l,o*u]),P=t[1].reshape([1,f,l]),L=[C,f,h*m],W.push(P),W.push(B);s&&W.push(t[2]);let oe=L[2],X=W[0].dims[W[0].dims.length-1];oe<8&&X<8?e.compute(bn(W,r,n,L,a,i),{inputs:W}):e.compute(Da(W,r,n,L,a,i),{inputs:W});return}let b=!0,w=e.kernelCustomData.wT??e.compute(at(t[1],Pa),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=w);let y=[t[0],w];s&&y.push(t[2]);let x=a?h*m:f,S=a?f:h*m,E=p*d*l;e.compute(wu(y,r,n,x,S,E,s,b,i),{inputs:y})},zu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=[0,t.pads[0],0,t.pads[1]],n=[1].concat(t.strides),s=[1].concat(t.dilations),o=[1].concat(t.kernelShape),u=Ua({...t,pads:a,strides:n,dilations:s,kernelShape:o},i);Cn(e,i,u,l=>r?[l[0],l[2],l[3]]:[l[0],l[1],l[3]])},Cu=(e,t,r)=>{let i=r.format==="NHWC"?"channelsLast":"channelsFirst",a=Ua(r,t),n=r.autoPad==="NOTSET"?r.pads:r.autoPad,s=xu(t[0].dims,t[1].dims,r.strides,r.dilations,n,!1,i);e.compute(Su(t,a,s.outShape,[s.filterDepth,s.filterHeight,s.filterWidth],[s.padInfo.front,s.padInfo.top,s.padInfo.left],i))},On=(e,t)=>{if(Iu(e.inputs,t),e.inputs[0].dims.length===3)zu(e,t);else if(e.inputs[0].dims.length===5)Cu(e,e.inputs,t);else{let r=Ua(t,e.inputs);Cn(e,e.inputs,r)}}}),Ou,Pc=z(()=>{"use strict";le(),Tt(),re(),Q(),Ou=(e,t,r)=>{let i=e.length>2,a=t.outputShape,n=t.format==="NHWC",s=t.group,o=e[1].dims,u=o[2]/s,l=o[3],p=n?R(u):1,d=n&&l===1&&u>=4,h=d?Math.floor(u/4)*4:Math.floor(u/p)*p,m=u-h,f=n?R(l):1,_=n?l===1?p:f:1,b=M.size(a)/f,w=[Math.ceil(b/64),1,1];Se("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${w}`);let y=["rank","rank"],x=[t.strides[0],t.strides[1]],S=[t.kernelShape[n?1:2],t.kernelShape[n?2:3]],E=[t.dilations[0],t.dilations[1]],C=[S[0]+(t.dilations[0]<=1?0:(t.kernelShape[n?1:2]-1)*(t.dilations[0]-1)),S[1]+(t.dilations[1]<=1?0:(t.kernelShape[n?2:3]-1)*(t.dilations[1]-1))],B=[C[0]-1-Math.floor((t.pads[0]+t.pads[2])/2),C[1]-1-Math.floor((t.pads[1]+t.pads[3])/2)],P=[{type:12,data:b},{type:12,data:x},{type:12,data:S},{type:12,data:E},{type:12,data:C},{type:6,data:B},{type:12,data:h},{type:12,data:u},{type:12,data:l},...I(e[0].dims,e[1].dims)];i&&(P.push(...I(e[2].dims)),y.push("rank")),P.push(...I(a));let L=W=>{let oe=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:x.length},{name:"filter_dims",type:"u32",length:S.length},{name:"dilations",type:"u32",length:S.length},{name:"effective_filter_dims",type:"u32",length:C.length},{name:"pads",type:"i32",length:B.length},{name:"input_channels_per_group_int",type:"u32"},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],X=A(e[0].dataType),ee=n?1:2,Ee=n?2:3,ke=n?3:1,ae=O("W",e[1].dataType,e[1].dims.length,_),ce=O("Dy",e[0].dataType,e[0].dims.length,p),Qe=[ce,ae];i&&Qe.push(O("bias",e[2].dataType,[a[ke]].length,f));let j=q("result",e[0].dataType,a.length,f),Ce=()=>{let J="";if(d)p===4?J+=`
        let xValue = ${ce.getByOffset("x_offset")};
        let wValue = ${ae.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;`:p===2?J+=`
          dotProd = dotProd + dot(vec4<${X}>(${ce.getByOffset("x_offset")}, ${ce.getByOffset("x_offset + 1u")}), vec4<${X}>(${ae.getByOffset("w_offset")}, ${ae.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;`:p===1&&(J+=`
          dotProd = dotProd + dot(vec4<${X}>(${ce.getByOffset("x_offset")}, ${ce.getByOffset("x_offset + 1u")}, ${ce.getByOffset("x_offset + 2u")}, ${ce.getByOffset("x_offset + 3u")}), vec4<${X}>(${ae.getByOffset("w_offset")}, ${ae.getByOffset("w_offset + 1u")}, ${ae.getByOffset("w_offset + 2u")}, ${ae.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);else if(J+=`
                  let xValue = ${n?ce.getByOffset(`${ce.indicesToOffset(`${ce.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p}`):ce.get("batch","inputChannel","idyR","idyC")};
        `,p===1)J+=`
          let w_offset = ${ae.indicesToOffset(`${ae.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${ae.getByOffset(`w_offset / ${_}`)};
          dotProd = dotProd + xValue * wValue;`;else for(let H=0;H<p;H++)J+=`
            let wValue${H} = ${ae.getByOffset(`${ae.indicesToOffset(`${ae.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${H}, wOutChannel)`)} / ${_}`)};
            dotProd = dotProd + xValue[${H}] * wValue${H};`;return J},G=()=>{if(m===0)return"";if(!d)throw new Error(`packInputAs4 ${d} is not true.`);let J="";if(p===1){J+="dotProd = dotProd";for(let H=0;H<m;H++)J+=`
            + ${ce.getByOffset(`x_offset + ${H}`)} * ${ae.getByOffset(`w_offset + ${H}`)}`;J+=";"}else if(p===2){if(m!==2)throw new Error(`Invalid inputChannelsRemainder ${m}.`);J+=`
          let xValue = ${ce.getByOffset("x_offset")};
          let wValue = ${ae.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`}return J},K=`
            let outputIndices = ${j.offsetToIndices(`global_idx * ${f}`)};
            let batch = ${j.indicesGet("outputIndices",0)};
            let d1 = ${j.indicesGet("outputIndices",ke)};
            let r = ${j.indicesGet("outputIndices",ee)};
            let c = ${j.indicesGet("outputIndices",Ee)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${j.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${X}(dyRCorner) + ${X}(wR)) / ${X}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${X}(uniforms.Dy_shape[${ee}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${X}(dyCCorner) + ${X}(wC)) / ${X}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${X}(uniforms.Dy_shape[${Ee}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${d?`
                var x_offset = ${ce.indicesToOffset(`${ce.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p};
                var w_offset = ${ae.indicesToOffset(`${ae.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${_};
                  `:""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${d?4:p}) {
                  ${Ce()}
                  inputChannel = inputChannel + ${d?4:p};
                }
                ${G()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${i?` + bias[d1 / ${f}]`:""};
            ${j.setByOffset("global_idx","value")};
          `;return`
    ${W.registerUniforms(oe).declareVariables(...Qe,j)}
      ${W.mainStart()}
      ${W.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${K}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${t.cacheKey};${p}${_}${f}${d}${m}`,inputDependencies:y},getRunData:()=>({dispatchGroup:{x:w[0],y:w[1],z:w[2]},outputs:[{dims:r?r(a):a,dataType:e[0].dataType}],programUniforms:P}),getShaderSource:L}}}),Au,Ru,Bu,An,Mu,Du,Rn,Pu,Uu,Uc=z(()=>{"use strict";Pc(),ti(),Nt(),Au=(e,t,r,i,a,n)=>(e-1)*t+r+(i-1)*a+1-n,Ru=(e,t,r,i,a)=>{let n=Math.floor(e/2);t==="SAME_UPPER"?(r[i]=n,r[a]=e-n):t==="SAME_LOWER"&&(r[i]=e-n,r[a]=n)},Bu=(e,t,r,i,a,n,s,o,u,l)=>{let p=e.length-2,d=l.length===0;u.length<p&&u.push(...Array(p-u.length).fill(0));let h=e[0],m=t[o?3:1]*a;for(let f=0,_=e.length-p-(o?1:0);f<p;++f,++_){let b=e[_],w=d?b*s[f]:l[f],y=Au(b,s[f],n[f],t[_],r[f],w);Ru(y,i,n,f,f+p),d&&l.push(s[f]*(b-1)+u[f]+(t[_]-1)*r[f]+1-n[f]-n[f+p])}l.splice(0,0,h),l.splice(o?3:1,0,m)},An=(e,t)=>{let r=e.kernelShape.slice();if(e.kernelShape.length===0||e.kernelShape.reduce((d,h)=>d*h,1)===0){r.length=0;for(let d=2;d<t[1].dims.length;++d)r.push(t[1].dims[d])}let i=e.format==="NHWC";r.splice(0,0,t[1].dims[0]),r.splice(i?3:1,0,t[1].dims[1]);let a=e.pads.slice(),n=e.outputShape.slice(),s=e.outputPadding.slice(),o=t[0].dims,u=e.dilations.slice();if(u.reduce((d,h)=>d+h,0)===0){let d=t[0].dims.length-2;u=new Array(d).fill(1)}let l=e.strides.slice();if(l.reduce((d,h)=>d+h,0)===0){let d=t[0].dims.length-2;l=new Array(d).fill(1)}Bu(o,r,u,e.autoPad,e.group,a,l,i,s,n);let p=Object.assign({},e);return Object.assign(p,{kernelShape:r,pads:a,outputPadding:s,outputShape:n,dilations:u,strides:l}),p},Mu=e=>{let t=wn(e),r=e.format,i=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof e.autoPad>"u"?0:e.autoPad],a=e.dilations,n=e.group??1,s=e.kernelShape,o=e.pads,u=e.strides,l=e.wIsConst(),p=e.outputPadding,d=e.outputShape;return{autoPad:i,format:r,dilations:a,group:n,kernelShape:s,outputPadding:p,outputShape:d,pads:o,strides:u,wIsConst:l,...t,cacheKey:`${e.format};${t.activation};`}},Du=(e,t)=>{if(!e||e.length!==2&&e.length!==3)throw new Error("Conv requires 2 or 3 inputs");if(e[0].dims.length!==4&&e[0].dims.length!==3)throw new Error("currently only support 2-dimensional conv");if(e[0].dims.length!==e[1].dims.length)throw new Error("filter does not have same dimension as input");let r=e[0].dims[t.format==="NHWC"?e[0].dims.length-1:1],i=e[1].dims[0];if(r!==i)throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let a=e[1].dims[1]*t.group;if(e.length===3&&(e[2].dims.length!==1||e[2].dims[0]!==a))throw new Error("invalid bias");let n=e[0].dims.length-2;if(t.dilations.reduce((s,o)=>s+o,0)>0&&t.dilations.length!==n)throw new Error(`dilations should be ${n}D`);if(t.strides.reduce((s,o)=>s+o,0)>0&&t.strides.length!==n)throw new Error(`strides should be ${n}D`);if(t.pads.reduce((s,o)=>s+o,0)>0&&t.pads.length!==n*2)throw new Error(`pads should be ${n*2}D`);if(t.outputPadding.length!==n&&t.outputPadding.length!==0)throw new Error(`output_padding should be ${n}D`);if(t.kernelShape.reduce((s,o)=>s+o,0)>0&&t.kernelShape.length!==0&&t.kernelShape.length!==e[1].dims.length-2)throw new Error("invalid kernel shape");if(t.outputShape.length!==0&&t.outputShape.length!==e[0].dims.length-2)throw new Error("invalid output shape")},Rn=(e,t,r,i)=>{let a=e.kernelCustomData.wT??e.compute(at(t[1],[2,3,0,1]),{inputs:[1],outputs:[r.wIsConst?-2:-1]})[0];r.wIsConst&&!e.kernelCustomData.wT&&(e.kernelCustomData.wT=a);let n=[t[0],a];t.length===3&&n.push(t[2]),e.compute(Ou(n,r,i),{inputs:n})},Pu=(e,t)=>{let r=t.format==="NHWC",i=[e.inputs[0].reshape(r?[e.inputs[0].dims[0],1,e.inputs[0].dims[1],e.inputs[0].dims[2]]:[e.inputs[0].dims[0],e.inputs[0].dims[1],1,e.inputs[0].dims[2]]),e.inputs[1].reshape([e.inputs[1].dims[0],e.inputs[1].dims[1],1,e.inputs[1].dims[2]])];e.inputs.length===3&&i.push(e.inputs[2]);let a=t.kernelShape;(a.length===0||a[0]===0)&&(a=[e.inputs[1].dims[2]]);let n=t.dilations;(n.length===0||n[0]===0)&&(n=[1]);let s=t.strides;(s.length===0||s[0]===0)&&(s=[1]);let o=t.pads;o.length===0&&(o=[0,0]),o=[0,o[0],0,o[1]],s=[1].concat(s),n=[1].concat(n),a=[1].concat(a);let u=t.outputPadding;u=[0].concat(u);let l=An({...t,pads:o,strides:s,dilations:n,kernelShape:a,outputPadding:u},i);Rn(e,i,l,p=>r?[p[0],p[2],p[3]]:[p[0],p[1],p[3]])},Uu=(e,t)=>{if(Du(e.inputs,t),e.inputs[0].dims.length===3)Pu(e,t);else{let r=An(t,e.inputs);Rn(e,e.inputs,r)}}}),Nu,Lu,Vu,Nc=z(()=>{"use strict";le(),re(),$(),Q(),Nu=(e,t,r,i)=>{let a=M.size(t),n=t.length,s=O("input",e,n),o=q("output",e,n),u=r.dataType===6?r.getInt32Array()[0]:Number(r.getBigInt64Array()[0]),l=M.normalizeAxis(u,n),p=d=>{let h=` i32(${s.indicesGet("inputIndices","uniforms.axis")}) `,m=D("uniforms.input_shape","uniforms.axis",n),f=i.reverse?h+(i.exclusive?" + 1":""):"0",_=i.reverse?m:h+(i.exclusive?"":" + 1");return`
                ${d.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(s,o)}
                ${d.mainStart()}
                  ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${o.offsetToIndices("global_idx")};
                  var sum = ${o.type.value}(0);
                  let first : i32 = ${f};
                  let last : i32 = ${_};
                  for (var i : i32 = first; i < last; i++) {
                    ${s.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${s.getByIndices("inputIndices")};
                  }
                  ${o.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:i.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:t,dataType:e}],dispatchGroup:{x:Math.ceil(a/64)},programUniforms:[{type:12,data:a},{type:12,data:l},...I(t,t)]}),getShaderSource:p}},Lu=(e,t)=>{let r=e.inputs[0].dims,i=e.inputs[0].dataType,a=e.inputs[1];e.compute(Nu(i,r,a,t),{inputs:[0]})},Vu=e=>{let t=e.exclusive===1,r=e.reverse===1;return g({exclusive:t,reverse:r})}}),Fu,qu,Gu,Wu,ju,Lc=z(()=>{"use strict";le(),re(),$(),Q(),Fu=e=>{if(!e||e.length!==1)throw new Error("DepthToSpace requires 1 input.");if(e[0].dims.length!==4)throw new Error("DepthToSpace requires 4D input.")},qu=(e,t,r,i)=>{let a=[];a.push(`fn perm(i: ${i.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);for(let n=0;n<t;++n)a.push(r.indicesSet("a",e[n],`i[${n}]`));return a.push("return a;}"),a.join(`
`)},Gu=(e,t)=>{let r,i,a,n,s,o,u=t.format==="NHWC",l=t.blocksize,p=t.mode==="DCR";u?([r,i,a,n]=e.dims,s=p?[r,i,a,l,l,n/l**2]:[r,i,a,n/l**2,l,l],o=p?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([r,i,a,n]=[e.dims[0],e.dims[2],e.dims[3],e.dims[1]],s=p?[r,l,l,n/l**2,i,a]:[r,n/l**2,l,l,i,a],o=p?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let d=e.reshape(s),h=d.dims.length,m=e.dataType,f=O("a",m,h),_=q("output",m,h),b=w=>`
  ${w.registerUniform("output_size","u32").declareVariables(f,_)}

  ${qu(o,h,f,_)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${_.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${_.setByOffset("global_idx",f.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${e.dims};${t.blocksize};${t.mode}`,inputDependencies:["rank"]},getRunData:w=>{let y=u?[r,i*l,a*l,n/l**2]:[r,n/l**2,i*l,a*l],x=M.size(y),S=d.dims,E=M.sortBasedOnPerm(S,o);return{outputs:[{dims:y,dataType:w[0].dataType}],dispatchGroup:{x:Math.ceil(x/64)},programUniforms:[{type:12,data:x},...I(S,E)]}},getShaderSource:b}},Wu=(e,t)=>{Fu(e.inputs),e.compute(Gu(e.inputs[0],t))},ju=e=>g({blocksize:e.blocksize,mode:e.mode,format:e.format})}),or,ga,Na,Bn,mr,Hu,Ku,Zu,Mn,Dn,Pn,Qu,Xu,Un,Yu,Ju,el,Vc=z(()=>{"use strict";le(),re(),$(),Q(),or=256,ga=512,Na=2*Math.PI,Bn=e=>{let t=[],r=e;for(let i of[4,2,3,5])for(;r%i===0;)t.push(i),r/=i;return r===1?t:void 0},mr=e=>{let t=e.toPrecision(9);return/[.eE]/.test(t)?t:`${t}.0`},Hu=(e,t,r,i,a)=>{let n=r/e,s=ga-i,o=l=>`smem[${s}u + base + ${l*t}u]`,u=`  for (var t = local_idx; t < ${n}u; t += ${or}u) {
`;u+=`    let twiddleIndex = t % ${t}u;
    let angleUnit = f32(twiddleIndex);
`,u+=`    var leg: array<vec2<f32>, 5>;
`;for(let l=0;l<e;l++){let p=`${i}u + t + ${l*n}u`;if(l===0)u+=`    leg[0] = smem[${p}];
`;else{let d=a*Na*l/(e*t);u+=`    { let a = ${mr(d)} * angleUnit; leg[${l}] = cmul(smem[${p}], vec2<f32>(cos(a), sin(a))); }
`}}if(u+=`    let base = (t / ${t}u) * ${t*e}u + twiddleIndex;
`,e===2)u+=`    ${o(0)} = leg[0] + leg[1];
    ${o(1)} = leg[0] - leg[1];
`;else if(e===4){let l=a<0?"vec2<f32>(oddDiff.y, -oddDiff.x)":"vec2<f32>(-oddDiff.y, oddDiff.x)";u+=`    let evenSum = leg[0] + leg[2]; let evenDiff = leg[0] - leg[2];
`,u+=`    let oddSum = leg[1] + leg[3]; let oddDiff = leg[1] - leg[3];
`,u+=`    let oddRot = ${l};
`,u+=`    ${o(0)} = evenSum + oddSum;
    ${o(1)} = evenDiff + oddRot;
`,u+=`    ${o(2)} = evenSum - oddSum;
    ${o(3)} = evenDiff - oddRot;
`}else for(let l=0;l<e;l++){let p=["leg[0]"];for(let d=1;d<e;d++){let h=a*Na*(d*l)/e,m=mr(Math.cos(h)),f=mr(Math.sin(h));p.push(`vec2<f32>(leg[${d}].x*${m} - leg[${d}].y*${f}, leg[${d}].x*${f} + leg[${d}].y*${m})`)}u+=`    ${o(l)} = ${p.join(" + ")};
`}return`${u}  }
  workgroupBarrier();
`},Ku=(e,t,r)=>{let i="",a=1,n=0;for(let s of e)i+=Hu(s,a,t,n,r),a*=s,n=ga-n;return{code:i,resultOffset:n}},Zu=(e,t,r,i,a)=>{let n=e.dims,s=n.length,o=n[s-1],u=n[t],l=r&&i?(u-1)*2:u;a!==void 0&&(l=a);let p=r&&i?1:2,d=i&&!r?Math.floor(l/2)+1:l,h=n.slice();h[t]=d,h[s-1]=p;let m=1;for(let _=t+1;_<s-1;_++)m*=n[_];let f=M.size(n)/o/u;return{dataType:e.dataType,outputDims:h,length:l,signalLength:u,inner:m,batch:f,inputComponents:o,outputComponents:p,outputLength:d,inverse:r,onesided:i}},Mn=(e,t)=>[t,e.length,e.inputComponents,e.outputComponents,e.inverse,e.onesided].join(";"),Dn=e=>[{type:12,data:e.batch},{type:12,data:e.signalLength},{type:12,data:e.inner},{type:12,data:e.outputLength}],Pn=(e,t,r)=>e.registerUniform("batch","u32").registerUniform("signalLength","u32").registerUniform("inner","u32").registerUniform("outputLength","u32").declareVariables(t,r),Qu=e=>{let{dataType:t,length:r,inputComponents:i,outputComponents:a,inverse:n,onesided:s}=e,o=k(t),u=n?1:-1,l=n?1/r:1,p=Bn(r),d=h=>{let m=O("x",t,[1]),f=q("y",t,[1]),_=E=>{let C=`inBase + (${E}) * uniforms.inner * ${i}u`,B=`f32(${m.getByOffset(C)})`,P=i===2?`f32(${m.getByOffset(`${C} + 1u`)})`:"0.0";return`vec2<f32>(${B}, ${P})`},b;if(n&&s){let E=Math.floor(r/2)+1,C=r%2===0?`select(provided, provided - 1u, provided == ${E}u)`:"provided";b=`
    let provided = min(uniforms.signalLength, ${E}u);
    for (var i = local_idx; i < ${r}u; i += ${or}u) {
      if (i < provided) { smem[i] = ${_("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();
    for (var k = local_idx + 1u; k < ${C}; k += ${or}u) {
      let h = smem[k];
      smem[${r}u - k] = vec2<f32>(h.x, -h.y);
    }
    workgroupBarrier();`}else b=`
    let loadCount = min(uniforms.signalLength, ${r}u);
    for (var i = local_idx; i < ${r}u; i += ${or}u) {
      if (i < loadCount) { smem[i] = ${_("i")}; } else { smem[i] = vec2<f32>(0.0); }
    }
    workgroupBarrier();`;let{code:w,resultOffset:y}=Ku(p,r,u),x=l===1?`smem[${y}u + i]`:`smem[${y}u + i] * ${mr(l)}`,S=a===2?f.setByOffset("off + 1u",`${o}(v.y)`):"";return`
  ${Pn(h,m,f)}
  var<workgroup> smem: array<vec2<f32>, ${2*ga}>;
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${h.mainStart(or)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${i}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${a}u;
    ${b}
${w}    for (var i = local_idx; i < uniforms.outputLength; i += ${or}u) {
      let v = ${x};
      let off = outBase + i * uniforms.inner * ${a}u;
      ${f.setByOffset("off",`${o}(v.x)`)}
      ${S}
    }
  }`};return{name:"DFT",shaderCache:{hint:Mn(e,"fft"),inputDependencies:["type"]},getShaderSource:d,getRunData:()=>({outputs:[{dims:e.outputDims,dataType:t}],programUniforms:Dn(e),dispatchGroup:{x:e.batch}})}},Xu=e=>{let{dataType:t,length:r,inputComponents:i,outputComponents:a,inverse:n,onesided:s}=e,o=k(t),u=n?1:-1,l=n?1/r:1,p=d=>{let h=O("x",t,[1]),m=q("y",t,[1]),f=x=>{let S=`inBase + (${x}) * uniforms.inner * ${i}u`,E=`f32(${h.getByOffset(S)})`,C=i===2?`f32(${h.getByOffset(`${S} + 1u`)})`:"0.0";return`vec2<f32>(${E}, ${C})`},_=n&&s?`fn spectrum(inBase: u32, k: u32) -> vec2<f32> {
    let provided = min(uniforms.signalLength, ${Math.floor(r/2)+1}u);
    if (k < provided) { return ${f("k")}; }
    let m = ${r}u - k;
    if (m < provided) {
      let h = ${f("m")};
      return vec2<f32>(h.x, -h.y);
    }
    return vec2<f32>(0.0, 0.0);
  }`:`fn spectrum(inBase: u32, n: u32) -> vec2<f32> {
    if (n < uniforms.signalLength) { return ${f("n")}; }
    return vec2<f32>(0.0, 0.0);
  }`,b=`
      let angle = ${mr(u*Na)} * f32(knMod) / ${mr(r)};
      acc += cmul(spectrum(inBase, n), vec2<f32>(cos(angle), sin(angle)));
      knMod += k;
      if (knMod >= ${r}u) { knMod -= ${r}u; }`,w=a===2?m.setByOffset("off + 1u",`${o}(v.y)`):"",y=l===1?"acc":`acc * ${mr(l)}`;return`
  ${Pn(d,h,m)}
  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }
  ${_}
  ${d.mainStart(or)}
    let row = workgroup_index;
    if (row >= uniforms.batch) { return; }
    let outer = row / uniforms.inner;
    let within = row % uniforms.inner;
    let inBase = (outer * uniforms.signalLength * uniforms.inner + within) * ${i}u;
    let outBase = (outer * uniforms.outputLength * uniforms.inner + within) * ${a}u;
    for (var k = local_idx; k < uniforms.outputLength; k += ${or}u) {
      var acc = vec2<f32>(0.0, 0.0);
      var knMod = 0u;
      for (var n = 0u; n < ${r}u; n++) {${b}
      }
      let v = ${y};
      let off = outBase + k * uniforms.inner * ${a}u;
      ${m.setByOffset("off",`${o}(v.x)`)}
      ${w}
    }
  }`};return{name:"DFT",shaderCache:{hint:Mn(e,"direct"),inputDependencies:["type"]},getShaderSource:p,getRunData:()=>({outputs:[{dims:e.outputDims,dataType:t}],programUniforms:Dn(e),dispatchGroup:{x:e.batch}})}},Un=e=>{if(!e||e.dataType===0)return;if(M.size(e.dims)!==1)throw new Error("DFT optional scalar inputs must have exactly 1 element.");if(e.dataType===6)return e.getInt32Array()[0];let t=Number(e.getBigInt64Array()[0]);if(!Number.isSafeInteger(t))throw new Error("DFT optional scalar inputs are out of JavaScript safe integer range.");return t},Yu=e=>{if(!e||e.length<1)throw new Error("DFT requires at least 1 input.");let t=e[0].dims;if(t.length<2)throw new Error("DFT input must have at least 2 dimensions.");let r=t[t.length-1];if(r!==1&&r!==2)throw new Error("DFT input's innermost dimension must be 1 (real) or 2 (complex).")},Ju=(e,t)=>{Yu(e.inputs);let r=e.inputs[0],i=r.dims.length,a=t.inverse!==0,n=t.onesided!==0,s=Un(e.inputs[1]);if(s!==void 0&&s<=0)throw new Error("dft_length must be greater than zero.");let o=M.normalizeAxis(Un(e.inputs[2])??t.axis,i);if(o===i-1)throw new Error("DFT axis must refer to a signal dimension, not the innermost (real/imaginary) dimension.");if(a&&n&&r.dims[i-1]!==2)throw new Error("Inverse one-sided DFT (IRFFT) requires complex-valued input (innermost dimension 2).");let u=Zu(r,o,a,n,s);if(u.length<=0)throw new Error(`Invalid DFT length: ${u.length}`);let l=u.length<=ga&&Bn(u.length)!==void 0?Qu(u):Xu(u);e.compute(l,{inputs:[0]})},el=e=>g({axis:e.axis??1,inverse:e.inverse??0,onesided:e.onesided??0})}),La,ya,Nn,tl,rl,il,al,Ln,nl,sl,ol,Fc=z(()=>{"use strict";le(),re(),$(),Q(),La="[a-zA-Z]|\\.\\.\\.",ya="("+La+")+",Nn="^"+ya+"$",tl="("+ya+",)*"+ya,rl="^"+tl+"$",il=class{constructor(e=-1){this.symbolToIndices=new Map,this.inputIndex=e}addSymbol(e,t){let r=this.symbolToIndices.get(e);r===void 0?r=[t]:r.push(t),this.symbolToIndices.set(e,r)}},al=class{constructor(e,t){var a;this.equation=t,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=new Array,this.outputDims=[];let[r,i]=t.includes("->")?t.split("->",2):[t,""];if(!r.match(RegExp(rl)))throw new Error("Invalid LHS term");if(r.split(",").forEach((n,s)=>{let o=e[s].dims.slice();if(!n.match(RegExp(Nn)))throw new Error("Invalid LHS term");let u=this.processTerm(n,!0,o,s);this.lhs.push(u)}),i==="")i+=[...this.symbolToInfo.entries()].filter(([n,s])=>s.count===1||n==="...").map(([n])=>n).join("");else if(!i.match(RegExp(ya)))throw new Error("Invalid RHS");(a=i.match(RegExp(La,"g")))==null||a.forEach(n=>{if(n==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let s=this.symbolToInfo.get(n);if(s===void 0)throw new Error("Invalid RHS symbol");this.outputDims.push(s.dimValue)}}),this.rhs=this.processTerm(i,!1,this.outputDims)}addSymbol(e,t,r){let i=this.symbolToInfo.get(e);if(i!==void 0){if(i.dimValue!==t&&i.count!==1)throw new Error("Dimension mismatch");i.count++,i.inputIndices.push(r)}else i={count:1,dimValue:t,inputIndices:[r]};this.symbolToInfo.set(e,i)}processTerm(e,t,r,i=-1){let a=r.length,n=!1,s=[],o=0;if(!e.match(RegExp(Nn))&&!t&&e!=="")throw new Error("Invalid LHS term");let u=e.match(RegExp(La,"g")),l=new il(i);return u==null||u.forEach((p,d)=>{if(p==="..."){if(n)throw new Error("Only one ellipsis is allowed per input term");n=!0;let h=a-u.length+1;if(h<0)throw new Error("Ellipsis out of bounds");if(s=r.slice(o,o+h),this.hasEllipsis){if(this.ellipsisDims.length!==s.length||this.ellipsisDims.toString()!==s.toString())throw new Error("Ellipsis dimensions mismatch")}else if(t)this.hasEllipsis=!0,this.ellipsisDims=s;else throw new Error("Ellipsis must be specified in the LHS");for(let m=0;m<s.length;m++){let f=String.fromCharCode(48+m);l.addSymbol(f,d+m),this.addSymbol(f,r[o++],i)}}else l.addSymbol(p,d+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(p,r[o++],i)}),l}},Ln=e=>e+"_max",nl=(e,t,r,i)=>{let a=e.map(l=>l.length).map((l,p)=>O(`input${p}`,t,l)),n=M.size(i),s=q("output",t,i.length),o=[...r.symbolToInfo.keys()].filter(l=>!r.rhs.symbolToIndices.has(l)),u=l=>{let p=[],d="var prod = 1.0;",h="var sum = 0.0;",m="sum += prod;",f=[],_=[],b=[],w=[],y=r.symbolToInfo.size===r.rhs.symbolToIndices.size;r.symbolToInfo.forEach((S,E)=>{var C;if(r.rhs.symbolToIndices.has(E)){let B=(C=r.rhs.symbolToIndices.get(E))==null?void 0:C[0];B!==void 0&&r.lhs.forEach((P,L)=>{if(S.inputIndices.includes(L)){let W=P.symbolToIndices.get(E);if(W===void 0)throw new Error("Invalid symbol error");W.forEach(oe=>{p.push(`${a[L].indicesSet(`input${L}Indices`,oe,s.indicesGet("outputIndices",B))}`)})}})}else r.lhs.forEach((B,P)=>{if(S.inputIndices.includes(P)){let L=B.symbolToIndices.get(E);if(L===void 0)throw new Error("Invalid symbol error");L.forEach(W=>{f.push(`${a[P].indicesSet(`input${P}Indices`,W,`${E}`)}`)}),w.push(`prod *= ${a[P].getByIndices(`input${P}Indices`)};`)}}),_.push(`for(var ${E}: u32 = 0; ${E} < uniforms.${Ln(E)}; ${E}++) {`),b.push("}")});let x=y?[...p,`let sum = ${a.map((S,E)=>S.getByIndices(`input${E}Indices`)).join(" * ")};`]:[...p,h,..._,...f,d,...w,m,...b];return`
            ${l.registerUniforms(o.map(S=>({name:`${Ln(S)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...a,s)}

            ${l.mainStart()}
            ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${s.offsetToIndices("global_idx")};
            ${a.map((S,E)=>`var input${E}Indices: ${a[E].type.indices};`).join(`
`)}
            ${x.join(`
`)};
            ${s.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:r.equation,inputDependencies:e.map(()=>"rank")},getRunData:()=>{let l=o.filter(d=>r.symbolToInfo.has(d)).map(d=>{var h;return{type:12,data:((h=r.symbolToInfo.get(d))==null?void 0:h.dimValue)||0}});l.push({type:12,data:n});let p=e.map((d,h)=>[...I(d)]).reduce((d,h)=>d.concat(h),l);return p.push(...I(i)),{outputs:[{dims:i,dataType:t}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:p}},getShaderSource:u}},sl=(e,t)=>{let r=new al(e.inputs,t.equation),i=r.outputDims,a=e.inputs.map((n,s)=>n.dims);e.compute(nl(a,e.inputs[0].dataType,r,i))},ol=e=>{let t=e.equation.replace(/\s+/g,"");return g({equation:t})}}),ul,Vn,ll,dl,pl,qc=z(()=>{"use strict";le(),re(),Q(),ul=e=>{if(!e||e.length!==2)throw new Error("Expand requires 2 input.");let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=r.length<t.length?0:r.length-t.length,a=t.length<r.length?0:t.length-r.length;for(;i<r.length&&a<t.length;++i,++a)if(r[i]!==t[a]&&r[i]!==1&&t[a]!==1)throw new Error("Expand requires shape to be broadcastable to input")},Vn=(e,t)=>{let r=e.length-t.length,i=[];for(let a=0;a<r;++a)i.push(e[a]);for(let a=0;a<t.length;++a)i.push(t[a]===1?e[a+r]:t[a]);return i},ll=(e,t)=>e.length>t.length?Vn(e,t):Vn(t,e),dl=e=>{let t=e[0].dims,r=Array.from(e[1].getBigInt64Array(),Number),i=ll(t,r),a=e[0].dataType,n=a===9||M.size(t)===1,s=a===9||t.length>0&&t[t.length-1]%4===0?4:1,o=n||i.length>0&&i[i.length-1]%4===0?4:1,u=Math.ceil(M.size(i)/o),l=d=>{let h=O("input",a,t.length,s),m=q("output",a,i.length,o),f;if(a===9){let _=(b,w,y="")=>`
          let outputIndices${w} = ${m.offsetToIndices(`outputOffset + ${w}u`)};
          let offset${w} = ${h.broadcastedIndicesToOffset(`outputIndices${w}`,m)};
          let index${w} = offset${w} / 4u;
          let component${w} = offset${w} % 4u;
          ${b}[${w}] = ${y}(${h.getByOffset(`index${w}`)}[component${w}]);
        `;f=`
        let outputOffset = global_idx * ${o};
        var data = vec4<u32>(0);
        ${_("data",0,"u32")}
        ${_("data",1,"u32")}
        ${_("data",2,"u32")}
        ${_("data",3,"u32")}
        ${m.setByOffset("global_idx","data")}
      }`}else f=`
        let outputIndices = ${m.offsetToIndices(`global_idx * ${o}`)};
        let inputOffset = ${h.broadcastedIndicesToOffset("outputIndices",m)};
        let data = ${m.type.value}(${h.getByOffset(`inputOffset / ${s}`)});
        ${m.setByOffset("global_idx","data")}
      }`;return`
    ${d.registerUniform("vec_size","u32").declareVariables(h,m)}
    ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${f}`},p=[{type:12,data:u},...I(t,i)];return{name:"Expand",shaderCache:{hint:`${i.length};${s}${o}`,inputDependencies:["rank"]},getShaderSource:l,getRunData:()=>({outputs:[{dims:i,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:p})}},pl=e=>{ul(e.inputs),e.compute(dl(e.inputs),{inputs:[0]})}}),cl,hl,Gc=z(()=>{"use strict";le(),re(),Q(),_n(),cl=e=>{let t=e[0].dataType,r=M.size(e[0].dims),i=M.size(e[1].dims),a=i%4===0,n=s=>{let o=O("x",t,[1],4),u=O("bias",t,[1],4),l=q("y",t,[1],4),p=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],d=m=>`
      let bias${m}_offset: u32 = (global_idx * 4 + ${m}) % uniforms.bias_size;
      let bias${m} = ${u.getByOffset(`bias${m}_offset / 4`)}[bias${m}_offset % 4];`,h=a?`
      let bias = ${u.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${d(0)}${d(1)}${d(2)}${d(3)}
      let bias = ${o.type.value}(bias0, bias1, bias2, bias3);`;return`${s.registerUniforms(p).declareVariables(o,u,l)}

    ${gn(k(t))}

    ${s.mainStart(T)}
      ${s.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${o.getByOffset("global_idx")};
      ${h}
      let x_in = x + bias;
      ${l.setByOffset("global_idx",yn("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${a}`,inputDependencies:["type","type"]},getShaderSource:n,getRunData:s=>({outputs:[{dims:s[0].dims,dataType:s[0].dataType}],programUniforms:[{type:12,data:Math.ceil(r/4)},{type:12,data:i}],dispatchGroup:{x:Math.ceil(r/T/4)}})}},hl=e=>{e.inputs.length<2||M.size(e.inputs[1].dims)===0?No(e):e.compute(cl(e.inputs))}}),fl,ml,gl,yl,Wc=z(()=>{"use strict";le(),re(),$(),Q(),fl=e=>{if(!e||e.length!==2)throw new Error("Gather requires 2 inputs.")},ml=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,n=M.normalizeAxis(t.axis,a),s=r.slice(0);s.splice(n,1,...i);let o=r[n],u=e[0].dataType===9?4:1,l=Math.ceil(M.size(s)/u),p=[{type:12,data:l},{type:6,data:o},{type:12,data:n},...I(e[0].dims,e[1].dims,s)],d=h=>{let m=O("data",e[0].dataType,e[0].dims.length,u),f=O("inputIndices",e[1].dataType,e[1].dims.length),_=q("output",e[0].dataType,s.length,u),b=y=>{let x=i.length,S=`var indicesIndices${y}  = ${f.type.indices}(0);`;for(let E=0;E<x;E++)S+=`${x>1?`indicesIndices${y}[${E}]`:`indicesIndices${y}`} = ${s.length>1?`outputIndices${y}[uniforms.axis + ${E}]`:`outputIndices${y}`};`;S+=`
          var idx${y} = ${f.getByIndices(`indicesIndices${y}`)};
          if (idx${y} < 0) {
            idx${y} = idx${y} + uniforms.axisDimLimit;
          }
          var dataIndices${y} : ${m.type.indices};
        `;for(let E=0,C=0;E<a;E++)E===n?(S+=`${a>1?`dataIndices${y}[${E}]`:`dataIndices${y}`} = u32(idx${y});`,C+=x):(S+=`${a>1?`dataIndices${y}[${E}]`:`dataIndices${y}`} = ${s.length>1?`outputIndices${y}[${C}]`:`outputIndices${y}`};`,C++);return S},w;if(e[0].dataType===9){let y=(x,S,E="")=>`
          let outputIndices${S} = ${_.offsetToIndices(`outputOffset + ${S}u`)};
          ${b(S)};
          let offset${S} = ${m.indicesToOffset(`dataIndices${S}`)};
          let index${S} = offset${S} / 4u;
          let component${S} = offset${S} % 4u;
          ${x}[${S}] = ${E}(${m.getByOffset(`index${S}`)}[component${S}]);
        `;w=`
        let outputOffset = global_idx * ${u};
        var value = vec4<u32>(0);
        ${y("value",0,"u32")}
        ${y("value",1,"u32")}
        ${y("value",2,"u32")}
        ${y("value",3,"u32")}
        ${_.setByOffset("global_idx","value")}
      `}else w=`
      let outputIndices = ${_.offsetToIndices("global_idx")};
      ${b("")};
      let value = ${m.getByIndices("dataIndices")};
      ${_.setByOffset("global_idx","value")};
      `;return`
      ${h.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(m,f,_)}
      ${h.mainStart()}
        ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${w}
      }`};return{name:"Gather",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:s,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:p}),getShaderSource:d}},gl=e=>g({axis:e.axis}),yl=(e,t)=>{let r=e.inputs;fl(r),e.compute(ml(e.inputs,t))}}),_l,wl,$l,jc=z(()=>{"use strict";le(),re(),Q(),_l=(e,t,r,i,a,n,s,o,u)=>{let l=[{type:12,data:n},{type:12,data:i},{type:12,data:a},{type:12,data:r},{type:12,data:s},{type:12,data:o},{type:12,data:u}],p=[n];l.push(...I(t.dims,p));let d=h=>{let m=O("indices_data",t.dataType,t.dims.length),f=q("input_slice_offsets_data",12,1,1),_=[m,f],b=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:a.length},{name:"sizes_from_slice_dims_data",type:"u32",length:r.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${h.registerUniforms(b).declareVariables(..._)}
  ${h.mainStart()}
    ${h.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${a.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return e.compute({name:"computeSliceOffsets",shaderCache:{hint:`${a.length}_${r.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:p,dataType:e.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:l}),getShaderSource:d},{inputs:[t],outputs:[-1]})[0]},wl=(e,t)=>{let r=e.inputs,i=r[0].dims,a=r[0].dataType,n=r[1].dims,s=n[n.length-1],o=M.sizeToDimension(n,n.length-1),u=M.sizeFromDimension(i,t.batchDims+s),l=M.sizeToDimension(i,t.batchDims),p=M.sizeFromDimension(i,t.batchDims),d=o/l,h=new Array(s),m=u;for(let S=0;S<s;++S)h[s-1-S]=m,m*=i[t.batchDims+s-1-S];let f=_l(e,r[1],h,t.batchDims,i,o,d,p,s),_=t.batchDims+s;if(_>i.length)throw new Error("last dimension of indices must not be larger than rank of input tensor");let b=n.slice(0,-1).concat(i.slice(_)),w=M.size(b),y=[{type:12,data:w},{type:12,data:u},...I(r[0].dims,f.dims,b)],x=S=>{let E=O("data",r[0].dataType,r[0].dims.length),C=O("slice_offsets",12,f.dims.length),B=q("output",r[0].dataType,b.length);return`
          ${S.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(E,C,B)}
            ${S.mainStart()}
            ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};e.compute({name:"GatherND",shaderCache:{hint:t.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:b,dataType:a}],dispatchGroup:{x:Math.ceil(w/64)},programUniforms:y}),getShaderSource:x},{inputs:[r[0],f]})},$l=e=>({batchDims:e.batch_dims,cacheKey:""})}),bl,vl,xl,Sl,Hc=z(()=>{"use strict";le(),re(),$(),Q(),bl=(e,t)=>{if(e.length<3||e.length>4)throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");let r=M.normalizeAxis(t.quantizeAxis,e[0].dims.length),i=t.blockSize,a=e[0],n=e[2],s=e.length===4?e[3]:void 0;if(n.dims.length!==a.dims.length||!a.dims.map((o,u)=>u===r?Math.ceil(o/i)===n.dims[u]:o===n.dims[u]).reduce((o,u)=>o&&u,!0))throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(s){if(s.dataType!==a.dataType)throw new Error("Zero point must have the same data type as the input tensor.");if(s.dims.length!==n.dims.length||!s.dims.map((o,u)=>o===n.dims[u]).reduce((o,u)=>o&&u,!0))throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},vl=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r.length,n=M.normalizeAxis(t.gatherAxis,a),s=M.normalizeAxis(t.quantizeAxis,a),o=r.slice(0);o.splice(n,1,...i);let u=M.size(o),l=e[2].dataType,p=e[0].dataType===22,d=[{type:12,data:u},{type:12,data:s},{type:12,data:n},{type:12,data:t.blockSize},...I(...e.map((m,f)=>m.dims),o)],h=m=>{let f=O("data",e[0].dataType,e[0].dims.length),_=O("inputIndices",e[1].dataType,e[1].dims.length),b=O("scales",e[2].dataType,e[2].dims.length),w=e.length>3?O("zeroPoint",e[3].dataType,e[3].dims.length):void 0,y=q("output",l,o.length),x=[f,_,b];w&&x.push(w);let S=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${m.registerUniforms(S).declareVariables(...x,y)}
        ${m.mainStart()}
        let output_indices = ${y.offsetToIndices("global_idx")};
        var indices_indices = ${_.type.indices}(0);
        ${i.length>1?`
          for (var i: u32 = 0; i < ${i.length}; i++) {
            let index = ${y.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${_.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${y.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${f.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${y.indicesGet("output_indices","i")};
          ${f.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${_.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[n]};
        }
        ${f.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${o.length}; i++) {
          let index = ${y.indicesGet("output_indices",`i + ${i.length} - 1`)};
          ${f.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${f.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${f.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${p?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${b.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${b.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${b.getByIndices("scale_indices")};
        ${w?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${w.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${w.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${p?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${k(l)}(quantized_data - zero_point) * scale;
        ${y.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${t.cacheKey};${e.filter((m,f)=>f!==1).map(m=>m.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:e.length},(m,f)=>"rank")},getRunData:()=>({outputs:[{dims:o,dataType:l}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:d}),getShaderSource:h}},xl=(e,t)=>{let r=e.inputs;bl(r,t),e.compute(vl(e.inputs,t))},Sl=e=>g({blockSize:e.blockSize,gatherAxis:e.gatherAxis,quantizeAxis:e.quantizeAxis})}),Tl,El,kl,Il,Kc=z(()=>{"use strict";le(),re(),$(),Q(),Tl=e=>{if(!e||e.length!==2)throw new Error("GatherElements requires 2 inputs.");if(e[0].dims.length<1)throw new Error("GatherElements requires that the data input be rank >= 1.");if(e[0].dims.length!==e[1].dims.length)throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},El=(e,t)=>{let r=e[0].dims,i=e[0].dataType,a=r.length,n=e[1].dims,s=e[1].dataType,o=M.normalizeAxis(t.axis,a),u=r[o],l=n.slice(0),p=M.size(l),d=O("input",i,a),h=O("indicesInput",s,n.length),m=q("output",i,l.length),f=[{type:12,data:p},{type:6,data:u},{type:12,data:o}];return f.push(...I(r,n,l)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:l,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:f}),getShaderSource:_=>`
      ${_.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(d,h,m)}
      ${_.mainStart()}
      ${_.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${m.offsetToIndices("global_idx")};

      var idx = ${h.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${d.type.indices}(outputIndices);
      ${d.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${d.getByIndices("inputIndices")};

      ${m.setByOffset("global_idx","value")};
  }`}},kl=e=>g({axis:e.axis}),Il=(e,t)=>{let r=e.inputs;Tl(r),e.compute(El(e.inputs,t))}}),zl,Cl,Ol,Al,Zc=z(()=>{"use strict";le(),re(),Q(),zl=e=>{if(!e)throw new Error("Input is missing");if(e.length<2||e.length>3)throw new Error("Invaid input number.");if(e.length===3&&e[2].dims.length>2)throw new Error("Invalid input shape of C");if(e[0].dataType!==e[1].dataType||e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("Input types are mismatched")},Cl=(e,t)=>{let r=e[0].dims.slice(),i=e[1].dims.slice(),[a,n,s]=mi.getShapeOfGemmResult(r,t.transA,i,t.transB,e.length===3?e[2].dims:void 0),o=[a,n];if(!o)throw new Error("Can't use gemm on the given tensors");let u=16,l=Math.ceil(n/u),p=Math.ceil(a/u),d=!0,h=M.size(o),m=[{type:12,data:d?l:h},{type:12,data:a},{type:12,data:n},{type:12,data:s},{type:1,data:t.alpha},{type:1,data:t.beta}],f=["type","type"];e.length===3&&(m.push(...I(e[2].dims)),f.push("rank")),m.push(...I(o));let _=w=>{let y="";t.transA&&t.transB?y="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":t.transA&&!t.transB?y="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!t.transA&&t.transB?y="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!t.transA&&!t.transB&&(y="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let x=t.alpha===1?"":"value *= uniforms.alpha;",S=O("a",e[0].dataType,e[0].dims),E=O("b",e[1].dataType,e[1].dims),C=S.type.value,B=null,P=[S,E];e.length===3&&(B=O("c",e[2].dataType,e[2].dims.length),P.push(B));let L=q("output",e[0].dataType,o.length);P.push(L);let W=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${w.registerUniforms(W).declareVariables(...P)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${C}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${y}
    }

    ${x}
    ${B!=null?`let cOffset = ${B.broadcastedIndicesToOffset("vec2(m, n)",L)}; value += ${C}(uniforms.beta) * ${B.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},b=w=>{let y=O("a",e[0].dataType,e[0].dims),x=O("b",e[1].dataType,e[1].dims),S=null,E=[y,x];e.length===3&&(S=O("c",e[2].dataType,e[2].dims.length),E.push(S));let C=q("output",e[0].dataType,o.length);E.push(C);let B=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],P="",L="";t.transA&&t.transB?(L=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):t.transA&&!t.transB?(L=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!t.transA&&t.transB?(L=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!t.transA&&!t.transB&&(L=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${y.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${x.type.value}(0);
      }
      `,P="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let W=t.alpha===1?"":"value *= uniforms.alpha;";return`
  ${w.registerUniforms(B).declareVariables(...E)}
  var<workgroup> tile_a: array<array<${y.type.storage}, ${u}>, ${u}>;
  var<workgroup> tile_b: array<array<${x.type.storage}, ${u}>, ${u}>;
  ${w.mainStart([u,u,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${u};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${u};
    let num_tiles = (uniforms.K - 1) / ${u} + 1;
    var k_start = 0u;
    var value = ${C.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${L}
      k_start = k_start + ${u};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${u}; k++) {
        ${P}
      }
      workgroupBarrier();
    }

    ${W}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${S!=null?`let cOffset = ${S.broadcastedIndicesToOffset("vec2(m, n)",C)}; value += ${C.type.value}(uniforms.beta) * ${S.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return d?{name:"GemmShared",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:l*p},programUniforms:m}),getShaderSource:b}:{name:"Gemm",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:o,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:m}),getShaderSource:_}},Ol=e=>{let t=e.transA,r=e.transB,i=e.alpha,a=e.beta;return{transA:t,transB:r,alpha:i,beta:a,cacheKey:`${e.transA};${e.transB};${e.alpha===1}`}},Al=(e,t)=>{zl(e.inputs),e.compute(Cl(e.inputs,t))}}),er,ur,ri,ii,Rl,Bl,Ml,Dl,Pl,Ul,Nl,Ll,Vl,Fl,Qc=z(()=>{"use strict";le(),re(),$(),Q(),[er,ur,ri,ii]=[0,1,2,3],Rl=e=>{if(e[0].dims.length!==4)throw new Error("only 4-D tensor is supported.");if(e[0].dims.length!==e[1].dims.length)throw new Error("input dimensions must be equal to grid dimensions");if(e[0].dims.length-2!==e[1].dims[e[1].dims.length-1])throw new Error(`last dimension of grid must be equal to ${e[0].dims.length-2}`);if(e[0].dims[0]!==e[1].dims[0])throw new Error("grid batch size must match input batch size")},Bl=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,Ml=e=>`
  fn gs_bicubic_interpolate(p: mat4x4<${e}>, x: f32, y: f32) -> ${e} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${e}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,Dl=e=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${e.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,Pl=e=>`
  ${e.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,Ul=(e,t,r)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${t} {
     var pixel = ${t}(0);
     var indices = vec4<u32>(0);
     indices[${er}] = batch;
     indices[${ur}] = channel;`+(()=>{switch(r.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${ri}] = u32(r);
            indices[${ii}] = u32(c);
          } else {
            return ${t}(0);
          }
        `;case"border":return`
          indices[${ri}] = u32(clamp(r, 0, H - 1));
          indices[${ii}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${ri}] = gs_reflect(r, border[1], border[3]);
          indices[${ii}] = gs_reflect(c, border[0], border[2]);
        `;default:throw new Error(`padding mode ${r.paddingMode} is not supported`)}})()+`
    return ${e.getByIndices("indices")};
  }
`,Nl=(e,t,r)=>(()=>{switch(r.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${er}], indices[${ur}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${er}], indices[${ur}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${er}], indices[${ur}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${er}], indices[${ur}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${er}], indices[${ur}], border);

          let dx2 = ${t}(f32(x2) - x);
          let dx1 = ${t}(x - f32(x1));
          let dy2 = ${t}(f32(y2) - y);
          let dy1 = ${t}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${t}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${er}], indices[${ur}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw new Error(`mode ${r.mode} is not supported`)}})()+`${e.setByOffset("global_idx","result")}`,Ll=(e,t)=>{let r=O("x",e[0].dataType,e[0].dims.length),i=[e[1].dims[0],e[1].dims[1],e[1].dims[2]],a=O("grid",e[1].dataType,i.length,2),n=[e[0].dims[0],e[0].dims[1],e[1].dims[1],e[1].dims[2]];t.format==="NHWC"&&(n=[e[0].dims[0],e[1].dims[1],e[1].dims[2],e[0].dims[3]],[er,ur,ri,ii]=[0,3,1,2]);let s=q("output",e[0].dataType,n.length),o=r.type.value,u=M.size(n),l=[{type:12,data:u},...I(e[0].dims,i,n)],p=d=>`
  ${d.registerUniform("output_size","u32").declareVariables(r,a,s)}
  ${Bl}
  ${Ml(o)}
  ${Dl(t)}
  ${Pl(t)}
  ${Ul(r,o,t)}

  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${ri}]);
      let W_in = i32(uniforms.x_shape[${ii}]);

      ${t.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${s.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${er}], indices[${ri}], indices[${ii}]);
      let nxy = ${a.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${Nl(s,o,t)}
  }`;return{name:"GridSample",shaderCache:{hint:`${t.cacheKey}`,inputDependencies:["type","type"]},getRunData:d=>{let h=M.size(n);return{outputs:[{dims:n,dataType:d[0].dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:l}},getShaderSource:p}},Vl=(e,t)=>{Rl(e.inputs),e.compute(Ll(e.inputs,t))},Fl=e=>g({alignCorners:e.align_corners,mode:e.mode,paddingMode:e.padding_mode,format:e.format})}),yt,ql,Gl,Fn,Wl,_a,jl,Hl=z(()=>{"use strict";le(),re(),$(),wi(),fn(),Q(),Nt(),yt=(e,t)=>e.length>t&&e[t].dims.length>0?e[t]:void 0,ql=(e,t)=>{let r=e[0],i=yt(e,1),a=yt(e,2),n=yt(e,3),s=yt(e,4),o=yt(e,5),u=yt(e,6),l=yt(e,7);if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let p=r.dims[0],d=r.dims[1],h=r.dims.length===3?r.dims[2]:t.numHeads*r.dims[4],m=d,f=0,_=0,b=Math.floor(h/t.numHeads);if(u&&l&&M.size(u.dims)&&M.size(l.dims)){if(u.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(u.dims[0]!==p||u.dims[1]!==t.numHeads||u.dims[3]!==b)throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(l.dims[0]!==p||l.dims[1]!==t.numHeads||l.dims[3]!==b)throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(u.dims[2]!==l.dims[2])throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(l.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');f=u.dims[2],_=u.dims[2]}else if(u&&M.size(u.dims)||l&&M.size(l.dims))throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w;if(i&&M.size(i.dims)>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(i.dims[2]!==r.dims[2])throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');w=2,m=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==b)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');w=5,m=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==b)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');w=0,m=i.dims[2]}}else{if(r.dims.length!==5)throw new Error('Input "query" is expected to have 5 dimensions when key is empty');if(r.dims[2]!==t.numHeads||r.dims[3]!==3)throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}if(n&&M.size(n.dims)>0){if(n.dims.length!==1)throw new Error('Input "bias" is expected to have 1 dimension');if(i&&i.dims.length===5&&i.dims[3]===2)throw new Error("bias is not allowed for packed kv.")}let y=f+m,x=0;if(s&&M.size(s.dims)>0){x=8;let B=s.dims;throw B.length===1?B[0]===p?x=1:B[0]===3*p+2&&(x=3):B.length===2&&B[0]===p&&B[1]===y&&(x=5),x===8?new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):new Error("Mask not supported")}let S=!1,E=h;if(a&&M.size(a.dims)>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(m!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');E=a.dims[2]}else{if(m!==a.dims[2])throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');E=a.dims[1]*a.dims[3],S=!0}}let C=!1;if(s&&M.size(s.dims)>0)throw new Error("Key padding mask is not supported");if(o&&M.size(o.dims)>0){if(o.dims.length!==4)throw new Error('Input "attention_bias" is expected to have 4 dimensions');if(o.dims[0]!==p||o.dims[1]!==t.numHeads||o.dims[2]!==d||o.dims[3]!==y)throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:p,sequenceLength:d,pastSequenceLength:f,kvSequenceLength:m,totalSequenceLength:y,maxSequenceLength:_,inputHiddenSize:0,hiddenSize:h,vHiddenSize:E,headSize:b,vHeadSize:Math.floor(E/t.numHeads),numHeads:t.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:t.maskFilterValue,maskType:x,scale:t.scale,broadcastResPosBias:C,passPastInKv:S,qkvFormat:w}},Gl=e=>g({...e}),Fn=g({perm:[0,2,1,3]}),Wl=(e,t,r,i,a,n,s)=>{let o=[i,a,n],u=M.size(o),l=[{type:12,data:u},{type:12,data:s},{type:12,data:n}],p=d=>{let h=q("qkv_with_bias",t.dataType,o),m=O("qkv",t.dataType,o),f=O("bias",r.dataType,o),_=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${d.registerUniforms(_).declareVariables(m,f,h)}
  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return e.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:o,dataType:t.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(u/64)},programUniforms:l}),getShaderSource:p},{inputs:[t,r],outputs:[-1]})[0]},_a=(e,t,r,i,a,n,s,o)=>{let u=n;if(s&&M.size(s.dims)>0){if(i===1)throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return u=Wl(e,n,s,t,i,r*a,o),u=u.reshape([t,i,r,a]),r===1||i===1?u:e.compute(at(u,Fn.perm),{inputs:[u],outputs:[-1]})[0]}else return n.dims.length===3&&(u=n.reshape([t,i,r,a])),r===1||i===1?u:e.compute(at(u,Fn.perm),{inputs:[u],outputs:[-1]})[0]},jl=(e,t)=>{let r=ql(e.inputs,t),i=e.inputs[0],a=yt(e.inputs,1),n=yt(e.inputs,2),s=yt(e.inputs,3),o=yt(e.inputs,4),u=yt(e.inputs,5),l=yt(e.inputs,6),p=yt(e.inputs,7);if(i.dims.length===5)throw new Error("Packed QKV is not implemented");if((a==null?void 0:a.dims.length)===5)throw new Error("Packed KV is not implemented");let d=a&&n&&a.dims.length===4&&n.dims.length===4,h=_a(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,i,s,0);if(d)return ca(e,h,a,n,o,void 0,l,p,u,r);if(!a||!n)throw new Error("key and value must be provided");let m=_a(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.headSize,a,s,r.hiddenSize),f=_a(e,r.batchSize,r.numHeads,r.kvSequenceLength,r.vHeadSize,n,s,2*r.hiddenSize);ca(e,h,m,f,o,void 0,l,p,u,r)}}),Kl,Zl,Ql,Xl,qn,Yl,Jl,ed=z(()=>{"use strict";le(),re(),$(),Q(),Kl=e=>{if(!e||e.length<1)throw new Error("too few inputs")},Zl=(e,t)=>{let r=[],i=t.numOutputs;return e[1].dims[0]>0&&(e[1].getBigInt64Array().forEach(a=>r.push(Number(a))),i=r.length),g({numOutputs:i,axis:t.axis,splitSizes:r})},Ql=e=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${e}u; i += 1u ) {
    if (index < ${D("uniforms.size_in_split_axis","i",e)}) {
        return i;
    }
    }
    return ${e}u;
}`,Xl=e=>{let t=e.length,r=[];for(let i=0;i<t;++i){let a=e[i].setByIndices("indices","input[global_idx]");t===1?r.push(a):i===0?r.push(`if (output_number == ${i}u) { ${a} }`):i===t-1?r.push(`else { ${a} }`):r.push(`else if (output_number == ${i}) { ${a} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${e[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`},qn=(e,t)=>{let r=e[0].dims,i=M.size(r),a=e[0].dataType,n=M.normalizeAxis(t.axis,r.length),s=new Array(t.numOutputs),o=O("input",a,r.length),u=new Array(t.numOutputs),l=[],p=[],d=0,h=[{type:12,data:i}];for(let f=0;f<t.numOutputs;f++){d+=t.splitSizes[f],u[f]=d;let _=r.slice();_[n]=t.splitSizes[f],p.push(_),s[f]=q(`output${f}`,a,_.length),l.push({dims:p[f],dataType:e[0].dataType})}h.push({type:12,data:u},...I(r,...p));let m=f=>`
  ${f.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",u.length).declareVariables(o,...s)}
  ${Ql(u.length)}
  ${Xl(s)}

  ${f.mainStart()}
    ${f.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${o.offsetToIndices("global_idx")};
    var index = ${o.indicesGet("indices",n)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${D("uniforms.size_in_split_axis","output_number - 1u",u.length)};
      ${o.indicesSet("indices",n,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:t.cacheKey,inputDependencies:["rank"]},getShaderSource:m,getRunData:()=>({outputs:l,dispatchGroup:{x:Math.ceil(i/64)},programUniforms:h})}},Yl=(e,t)=>{Kl(e.inputs);let r=e.inputs.length===1?t:Zl(e.inputs,t);e.compute(qn(e.inputs,r),{inputs:[0]})},Jl=e=>{let t=e.axis,r=e.splitSizes,i=e.numOutputs<0?r.length:e.numOutputs;if(i!==r.length)throw new Error("numOutputs and splitSizes length must be equal");return g({axis:t,numOutputs:i,splitSizes:r})}}),td,Va,rd,id=z(()=>{"use strict";le(),re(),$(),Q(),td=(e,t)=>{let[r,i,a,n]=e,{numHeads:s,rotaryEmbeddingDim:o}=t;if(r.dims.length!==3&&r.dims.length!==4)throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);if(!M.areEqual(i.dims,[])&&!M.areEqual(i.dims,[1])&&i.dims.length!==2)throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${i.dims.length}`);if(a.dims.length!==2)throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${a.dims.length}`);if(n.dims.length!==2)throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${n.dims.length}`);if(!M.areEqual(a.dims,n.dims))throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(o>0&&s===0)throw new Error("num_heads must be provided if rotary_embedding_dim is specified");let u=r.dims[0],l=r.dims[r.dims.length-2],p=a.dims[0],d=M.sizeFromDimension(r.dims,1)/l,h=o===0?a.dims[1]*2:d/s;if(o>h)throw new Error("rotary_embedding_dim must be less than or equal to head_size");if(i.dims.length===2){if(u!==i.dims[0])throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${i.dims[0]}`);if(l!==i.dims[1])throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${i.dims[1]}`)}if(l>p)throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");if(h/2!==a.dims[1]&&o/2!==a.dims[1])throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${a.dims[1]}`)},Va=(e,t)=>{let{interleaved:r,numHeads:i,rotaryEmbeddingDim:a,scale:n}=t,s=e[0].dims[0],o=M.sizeFromDimension(e[0].dims,1),u=e[0].dims[e[0].dims.length-2],l=o/u,p=e[2].dims[1],d=a===0?p*2:l/i,h=new Array(s,u,l/d,d-p),m=M.computeStrides(h),f=[{type:1,data:n},{type:12,data:h},{type:12,data:m},...e[0].dims.length===3?new Array({type:12,data:[o,l,d,1]}):[],...e[0].dims.length===4?new Array({type:12,data:[o,d,u*d,1]}):[],...I(e[0].dims,e[1].dims,e[2].dims,e[3].dims,e[0].dims)],_=b=>{let w=O("input",e[0].dataType,e[0].dims.length),y=O("position_ids",e[1].dataType,e[1].dims.length),x=O("cos_cache",e[2].dataType,e[2].dims.length),S=O("sin_cache",e[3].dataType,e[3].dims.length),E=q("output",e[0].dataType,e[0].dims.length);return b.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:h.length},{name:"global_strides",type:"u32",length:m.length},{name:"input_output_strides",type:"u32",length:m.length}]),`
        ${b.declareVariables(w,y,x,S,E)}

        ${b.mainStart(T)}
          let half_rotary_emb_dim = uniforms.${x.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${b.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${y.broadcastedIndicesToOffset("bsnh.xy",q("",y.type.tensor,2))};
            let position_id =
                u32(${y.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${w.getByOffset("i")} * ${x.get("position_id","bsnh[3]")} -
                ${w.getByOffset("j")} * ${S.get("position_id","bsnh[3]")};
            ${E.setByOffset("i","re")}
            let im = ${w.getByOffset("i")} * ${S.get("position_id","bsnh[3]")} +
                ${w.getByOffset("j")} * ${x.get("position_id","bsnh[3]")};
            ${E.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${E.setByOffset("k",w.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:g({interleaved:r}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:_,getRunData:()=>({outputs:[{dims:e[0].dims,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(M.size(h)/T)},programUniforms:f})}},rd=(e,t)=>{td(e.inputs,t),e.compute(Va(e.inputs,t))}}),ad,nd,Gn,sd,od,Xc=z(()=>{"use strict";$(),le(),fn(),Hl(),ed(),Nt(),id(),Q(),ad=(e,t)=>{if(t.doRotary&&e.length<=7)throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let r=e[0],i=e[1],a=e[2],n=e[3],s=e[4];if(t.doRotary!==0&&e.length<=7)throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");if(t.localWindowSize!==-1)throw new Error("Local attention is not supported");if(t.softcap!==0)throw new Error("Softcap is not supported");if(t.rotaryInterleaved!==0)throw new Error("Rotary interleaved is not supported");if(t.smoothSoftmax)throw new Error("Smooth softmax is not supported");if(r.dims.length!==3&&r.dims.length!==5)throw new Error("Input query is expected to have 3 or 5 dimensions");let o=!1,u=r.dims[0],l=r.dims[1],p=r.dims.length===3?o?r.dims[2]/3:r.dims[2]:t.numHeads*r.dims[4],d=l,h=0,m=!i||i.dims.length===0,f=Math.floor(m?p/(t.numHeads+2*t.kvNumHeads):p/t.numHeads);m&&(p=f*t.numHeads);let _=n&&n.dims.length!==0,b=s&&s.dims.length!==0;if(_&&n.dims.length===4&&n.dims[0]===u&&n.dims[1]!==t.kvNumHeads&&n.dims[2]===t.kvNumHeads&&n.dims[3]===f)throw new Error("BSNH pastKey/pastValue is not supported");if(_&&b){if(n.dims.length!==4)throw new Error('Input "past_key" is expected to have 4 dimensions');if(s.dims.length!==4)throw new Error('Input "past_value" is expected to have 4 dimensions');h=n.dims[2]}else if(_||b)throw new Error('Input "past_key" and "past_value" shall be both present or both absent');let w=1;if(i&&i.dims.length>0){if(r.dims.length!==3)throw new Error('Input "query" is expected to have 3 dimensions when key is given');if(i.dims.length<3||i.dims.length>5)throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(r.dims[0]!==i.dims[0])throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');if(i.dims.length===3){if(r.dims[2]%i.dims[2]!==0)throw new Error('Dimension 2 of "query" should be a multiple of "key"');d=i.dims[1]}else if(i.dims.length===5){if(i.dims[2]!==t.numHeads||i.dims[3]!==2||i.dims[4]!==f)throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(a)throw new Error('Expect "value" be none when "key" has packed kv format.');d=i.dims[1]}else{if(i.dims[1]!==t.numHeads||i.dims[3]!==f)throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');d=i.dims[2]}}else{if(r.dims.length!==3&&r.dims.length!==5)throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(r.dims.length===5&&(r.dims[2]!==t.numHeads||r.dims[3]!==3))throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');w=3}let y=0,x=!1,S=t.kvNumHeads?f*t.kvNumHeads:p;if(a&&a.dims.length>0){if(a.dims.length!==3&&a.dims.length!==4)throw new Error('Input "value" is expected to have 3 or 4 dimensions');if(r.dims[0]!==a.dims[0])throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(a.dims.length===3){if(d!==a.dims[1])throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');S=a.dims[2]}else{if(d!==a.dims[2])throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');S=a.dims[1]*a.dims[3],x=!0}}let E=e.length>4?e[5]:void 0;if(E){if(E.dims.length===0)throw new Error("seqlens_k must be at least 1D, got scalar.");let C=E.dims.reduce((B,P)=>B*P,1);if(C!==u)throw new Error(`seqlens_k must have batch_size (${u}) elements, got ${C}.`);for(let B=0;B<E.dims.length;B++)if(E.dims[B]!==1&&E.dims[B]!==u)throw new Error(`seqlens_k has unexpected shape. Each dimension must be 1 or batch_size (${u}), got dims[${B}] = ${E.dims[B]}.`)}return{batchSize:u,sequenceLength:l,pastSequenceLength:h,kvSequenceLength:d,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:p,vHiddenSize:S,headSize:f,vHeadSize:Math.floor(S/t.kvNumHeads),numHeads:t.numHeads,kvNumHeads:t.kvNumHeads,nReps:t.numHeads/t.kvNumHeads,pastPresentShareBuffer:!1,maskType:y,scale:t.scale,broadcastResPosBias:!1,passPastInKv:x,qkvFormat:w}},nd=g({perm:[0,2,1,3]}),Gn=(e,t,r)=>{let i=t,a=r.kvNumHeads;return t.dims.length===3&&r.kvSequenceLength!==0&&(i=t.reshape([r.batchSize,r.kvSequenceLength,a,r.headSize]),i=e.compute(at(i,nd.perm),{inputs:[i],outputs:[-1]})[0]),i},sd=(e,t,r,i)=>{let a=7,n=["type","type"],s=[e*t],o=e*t,u=[{type:12,data:o},{type:12,data:t},{type:12,data:e}],l=p=>{let d=O("seq_lens",r.dataType,r.dims),h=O("total_seq_lens",i.dataType,i.dims),m=q("pos_ids",a,s),f=[{name:"output_size",type:"u32"},{name:"sequence_length",type:"u32"},{name:"batch_size",type:"u32"}];return`
  ${p.registerUniforms(f).declareVariables(d,h,m)}
  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${h.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${d.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${m.setByOffset("global_idx","pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${m.setByOffset("global_idx","pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${m.setByOffset("global_idx","seqlen")}
    };
  }
  `};return{name:"GeneratePositionIds",shaderCache:{hint:`${e};${t}`,inputDependencies:n},getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:Math.ceil(o/64)},programUniforms:u}),getShaderSource:l}},od=(e,t)=>{var S;if(e.inputs.length>14&&e.inputs[14]||e.inputs.length>15&&e.inputs[15])throw new Error("GroupQueryAttention (JSEP): q_norm_weight / k_norm_weight inputs are not supported. The per-head Q/K RMS normalization prologue is implemented only on the CUDA and native WebGPU EPs.");let r=ad(e.inputs,t);if(e.inputs[0].dims.length===5)throw new Error("Packed QKV is not implemented");if(((S=e.inputs[1])==null?void 0:S.dims.length)===5)throw new Error("Packed KV is not implemented");let i=e.inputs[0],a=e.inputs[1]&&e.inputs[1].dims.length>0?e.inputs[1]:void 0,n=e.inputs[2]&&e.inputs[2].dims.length>0?e.inputs[2]:void 0,s=e.inputs[3]&&e.inputs[3].dims.length!==0?e.inputs[3]:void 0,o=e.inputs[4]&&e.inputs[4].dims.length!==0?e.inputs[4]:void 0,u=e.inputs.length>4?e.inputs[5]:void 0,l=e.inputs.length>5?e.inputs[6]:void 0,p=r.kvNumHeads?r.kvNumHeads:r.numHeads,d=g({axis:2,numOutputs:3,splitSizes:[r.numHeads*r.headSize,p*r.headSize,p*r.headSize]}),[h,m,f]=!a&&!n?e.compute(qn([i],d),{inputs:[i],outputs:[-1,-1,-1]}):[i,a,n],_,b;if(t.doRotary){let E=e.compute(sd(r.batchSize,r.sequenceLength,u,l),{inputs:[u,l],outputs:[-1]})[0],C=e.inputs[7],B=e.inputs[8],P=g({interleaved:t.rotaryInterleaved!==0,numHeads:r.numHeads,rotaryEmbeddingDim:0,scale:t.scale}),L=[h,E,C,B],W=[-1];_=e.compute(Va(L,P),{inputs:L,outputs:W})[0],L.splice(0,1,m);let oe=g({interleaved:t.rotaryInterleaved!==0,numHeads:r.kvNumHeads,rotaryEmbeddingDim:0,scale:t.scale});b=e.compute(Va(L,oe),{inputs:L,outputs:W})[0]}let w=_a(e,r.batchSize,r.numHeads,r.sequenceLength,r.headSize,t.doRotary?_:h,void 0,0),y=Gn(e,t.doRotary?b:m,r),x=Gn(e,f,r);ca(e,w,y,x,void 0,void 0,s,o,void 0,r,u,l)}}),Wn,ud,ld,dd,Yc=z(()=>{"use strict";le(),re(),Nt(),Q(),Wn=(e,t,r,i,a,n,s,o)=>{let u=R(n),l=u===1?"f32":`vec${u}f`,p=u===1?"vec2f":`mat2x${u}f`,d=a*s,h=64;d===1&&(h=256);let m=[a,s,n/u],f=[a,s,2],_=["rank","type","type"],b=[];b.push(...I(m,f));let w=y=>{let x=O("x",t.dataType,3,u),S=O("scale",r.dataType,r.dims),E=O("bias",i.dataType,i.dims),C=q("output",1,3,2),B=[x,S,E,C];return`
  var<workgroup> workgroup_shared : array<${p}, ${h}>;
  const workgroup_size = ${h}u;
  ${y.declareVariables(...B)}
  ${y.mainStart(h)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${l}(0);
    var squared_sum = ${l}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${l}(${x.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${p}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${U("workgroup_shared[0][0]",u)} / f32(hight * ${u});
      let squared_sum_final = ${U("workgroup_shared[0][1]",u)} / f32(hight * ${u});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${o}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return e.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${u};${o};${h}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:f,dataType:1}],dispatchGroup:{x:d},programUniforms:b}),getShaderSource:w},{inputs:[t,r,i],outputs:[-1]})[0]},ud=(e,t,r)=>{let i=t[0].dims,a=i,n=2,s=i[0],o=i[1],u=M.sizeFromDimension(i,n),l=R(u),p=M.size(a)/l,d=Wn(e,t[0],t[1],t[2],s,u,o,r.epsilon),h=[s,o,u/l],m=[s,o],f=["type","none"],_=b=>{let w=O("x",t[0].dataType,h.length,l),y=O("scale_shift",1,m.length,2),x=q("output",t[0].dataType,h.length,l),S=[w,y,x];return`
  ${b.registerUniform("output_size","u32").declareVariables(...S)}
  ${b.mainStart()}
  ${b.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${x.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${y.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${w.getByOffset("global_idx")} * ${x.type.value}(scale_shift.x) + ${x.type.value}(scale_shift.y);
      ${x.setByOffset("global_idx","value")};
  }`};e.compute({name:"InstanceNormalization",shaderCache:{hint:`${l}`,inputDependencies:f},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(p/64)},programUniforms:[{type:12,data:p},...I(h,m,h)]}),getShaderSource:_},{inputs:[t[0],d]})},ld=(e,t,r)=>{let i=t[0].dims,a=i,n=i[0],s=i[i.length-1],o=M.sizeFromDimension(i,1)/s,u=R(s),l=M.size(a)/u,p=[{type:12,data:o},{type:12,data:Math.floor(s/u)}],d=["type","type"],h=!1,m=[0,i.length-1];for(let w=0;w<i.length-2;w++)h=h||i[w+1]!==1,m.push(w+1);h=h&&i[i.length-1]!==1;let f=h?e.compute(at(e.inputs[0],m),{inputs:[e.inputs[0]],outputs:[-1]})[0]:e.inputs[0].reshape(Array.from({length:i.length},(w,y)=>i[m[y]])),_=Wn(e,f,t[1],t[2],n,o,s,r.epsilon),b=w=>{let y=A(t[0].dataType),x=u===1?"vec2f":`mat${u}x2f`,S=B=>{let P=B===0?"x":"y",L=u===1?"f32":`vec${u}f`;switch(u){case 1:return`${y}(${L}(scale.${P}))`;case 2:return`vec2<${y}>(${L}(scale[0].${P}, scale[1].${P}))`;case 4:return`vec4<${y}>(${L}(scale[0].${P}, scale[1].${P}, scale[2].${P}, scale[3].${P}))`;default:throw new Error(`Not supported compoents ${u}`)}},E=O("input",t[0].dataType,t[0].dims,u),C=q("output",t[0].dataType,a,u);return`
  @group(0) @binding(0) var<storage, read> input : array<${E.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${x}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${C.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${w.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${S(0)}, ${S(1)});
  }`};e.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${u}`,inputDependencies:d},getRunData:()=>({outputs:[{dims:a,dataType:t[0].dataType}],dispatchGroup:{x:Math.ceil(l/64)},programUniforms:p}),getShaderSource:b},{inputs:[t[0],_]})},dd=(e,t)=>{t.format==="NHWC"?ld(e,e.inputs,t):ud(e,e.inputs,t)}}),pd,cd,hd,Jc=z(()=>{"use strict";le(),re(),Q(),pd=e=>{if(!e||e.length<2)throw new Error("layerNorm requires at least 2 inputs.")},cd=(e,t,r)=>{let i=t.simplified,a=e[0].dims,n=e[1],s=!i&&e[2],o=a,u=M.normalizeAxis(t.axis,a.length),l=M.sizeToDimension(a,u),p=M.sizeFromDimension(a,u),d=M.size(n.dims),h=s?M.size(s.dims):0;if(d!==p||s&&h!==p)throw new Error(`Size of X.shape()[axis:] == ${p}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${d} and bias size of ${h}`);let m=[];for(let E=0;E<a.length;++E)E<u?m.push(a[E]):m.push(1);let f=R(p),_=["type","type"],b=[{type:12,data:l},{type:1,data:p},{type:12,data:Math.floor(p/f)},{type:1,data:t.epsilon}];s&&_.push("type");let w=r>1,y=r>2,x=E=>{let C=A(e[0].dataType),B=[O("x",e[0].dataType,e[0].dims,f),O("scale",n.dataType,n.dims,f)];s&&B.push(O("bias",s.dataType,s.dims,f)),B.push(q("output",e[0].dataType,o,f)),w&&B.push(q("mean_data_output",1,m)),y&&B.push(q("inv_std_output",1,m));let P=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${E.registerUniforms(P).declareVariables(...B)}
  ${E.mainStart()}
    ${E.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${N("f32",f)};
    var mean_square_vector = ${N("f32",f)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${F(C,f,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${U("mean_vector",f)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${U("mean_square_vector",f)} / uniforms.norm_size ${i?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${F(C,f,"x[j + offset]")};
      let f32scale = ${F(C,f,"scale[j]")};
      output[j + offset] = ${B[0].type.value}((f32input ${i?"":"- mean"}) * inv_std_dev * f32scale
        ${s?`+ ${F(C,f,"bias[j]")}`:""}
      );
    }

    ${w?"mean_data_output[global_idx] = mean":""};
    ${y?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},S=[{dims:o,dataType:e[0].dataType}];return w&&S.push({dims:m,dataType:1}),y&&S.push({dims:m,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${f};${r};${i}`,inputDependencies:_},getRunData:()=>({outputs:S,dispatchGroup:{x:Math.ceil(l/64)},programUniforms:b}),getShaderSource:x}},hd=(e,t)=>{pd(e.inputs),e.compute(cd(e.inputs,t,e.outputCount))}}),fd,md,eh=z(()=>{"use strict";re(),vn(),En(),fd=e=>{if(!e||e.length!==2)throw new Error("MatMul requires 2 inputs.");if(e[0].dims[e[0].dims.length-1]!==e[1].dims[e[1].dims.length-2])throw new Error("shared dimension does not match.")},md=e=>{fd(e.inputs);let t=Xt.calcShape(e.inputs[0].dims,e.inputs[1].dims,!0);if(!t)throw new Error("Can't use matmul on the given tensors");let r=t[t.length-1],i=e.inputs[0].dims[e.inputs[0].dims.length-1];if(r<8&&i<8)e.compute(bn(e.inputs,{activation:""},t));else{let a=t[t.length-2],n=M.size(e.inputs[0].dims.slice(0,-2)),s=M.size(e.inputs[1].dims.slice(0,-2));if(n!==1&&a===1&&s===1){let o=e.inputs[0].reshape([1,n,i]),u=e.inputs[1].reshape([1,i,r]),l=[1,n,r],p=[o,u];e.compute(Da(p,{activation:""},t,l),{inputs:p})}else e.compute(Da(e.inputs,{activation:""},t))}}}),gd,yd,_d,wd,$d,th=z(()=>{"use strict";le(),re(),$(),Q(),gd=(e,t)=>{if(e.length<3||e.length>4)throw new Error("MatMulNBits requires 3 or 4 inputs");let r=e[0],i=r.dims.length;if(r.dims[i-1]!==t.k)throw new Error("The last dim of input shape does not match the k value");let a=Math.floor((t.k+t.blockSize-1)/t.blockSize),n=t.blockSize/8*t.bits,s=e[1];if(!M.areEqual(s.dims,[t.n,a,n]))throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let o=e[2].dims;if(M.size(o)!==t.n*a)throw new Error("scales input size error.");if(e.length===4){let u=e[3].dims,l=t.n*(t.bits===8?a:Math.floor((a*t.bits+7)/8));if(M.size(u)!==l)throw new Error("zeroPoints input size error.")}},yd=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],n=t.k,s=t.n,o=r.slice(0,i-2),u=M.size(o),l=e[1].dims[2]/4,p=e[0].dataType,d=R(t.k),h=R(l),m=R(s),f=o.concat([a,s]),_=a>1&&s/m%2===0?2:1,b=M.size(f)/m/_,w=64,y=[],x=[u,a,n/d],S=M.convertShape(e[1].dims).slice();S.splice(-1,1,l/h),y.push(...I(x)),y.push(...I(S)),y.push(...I(e[2].dims)),e.length===4&&y.push(...I(M.convertShape(e[3].dims)));let E=[u,a,s/m];y.push(...I(E));let C=B=>{let P=x.length,L=O("a",e[0].dataType,P,d),W=O("b",12,S.length,h),oe=O("scales",e[2].dataType,e[2].dims.length),X=[L,W,oe],ee=e.length===4?O("zero_points",12,e[3].dims.length):void 0;ee&&X.push(ee);let Ee=E.length,ke=q("output",e[0].dataType,Ee,m),ae=A(e[0].dataType),ce=(()=>{switch(d){case 1:return`array<${ae}, 8>`;case 2:return`mat4x2<${ae}>`;case 4:return`mat2x4<${ae}>`;default:throw new Error(`${d}-component is not supported.`)}})(),Qe=Math.floor(32/t.bits),j=Math.floor(Qe/8),Ce=()=>{let J="";for(let H=0;H<j;H++){let Re=H*t.bits*4,lr=Re+t.bits;J+=`
          // reuse a data (pass ${H})
            var input_offset${H>0?H:""} = ${H===0?L.indicesToOffset(`${L.type.indices}(batch, row, word_offset)`):"input_offset"};
            var a_data${H>0?H:""}: ${ce};
            for (var j${H>0?H:""}: u32 = 0; j${H>0?H:""} < ${8/d}; j${H>0?H:""}++) {
              a_data${H>0?H:""}[j${H>0?H:""}] = ${L.getByOffset(`input_offset${H>0?H:""}`)};
              input_offset${H>0?H:""}++;
            }
          `;for(let ot=0;ot<m*_;ot++)J+=`
            b_value = ${h===1?`b${ot}_data`:`b${ot}_data[i]`};
            ${t.bits===2?`{
              let half_word = b_value >> ${H*16}u;
              let byte_lo = half_word & 0xFFu;
              let byte_hi = (half_word >> 8u) & 0xFFu;
              let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
              b_value_lower = unpack4xU8(spread_word & b_mask);
              b_value_upper = unpack4xU8((spread_word >> 2u) & b_mask);
            }`:`b_value_lower = unpack4xU8((b_value >> ${Re}u) & b_mask);
            b_value_upper = unpack4xU8((b_value >> ${lr}u) & b_mask);`}
            b_quantized_values = ${ce}(${Array.from({length:4},(Ht,Kt)=>`${ae}(b_value_lower[${Kt}]), ${ae}(b_value_upper[${Kt}])`).join(", ")});
            b_dequantized_values = ${d===1?`${ce}(${Array.from({length:8},(Ht,Kt)=>`(b_quantized_values[${Kt}] - ${ee?`zero_point${ot}`:"zero_point"}) * scale${ot}`).join(", ")});`:`(b_quantized_values - ${ce}(${Array(8).fill(`${ee?`zero_point${ot}`:"zero_point"}`).join(",")})) * scale${ot};`};
            workgroup_shared[local_id.x * ${_} + ${Math.floor(ot/m)}]${m>1?`[${ot%m}]`:""} += ${Array.from({length:8/d},(Ht,Kt)=>`${d===1?`a_data${H>0?H:""}[${Kt}] * b_dequantized_values[${Kt}]`:`dot(a_data${H>0?H:""}[${Kt}], b_dequantized_values[${Kt}])`}`).join(" + ")};
          `}return J},G=()=>{let J=`
            var col_index = col * ${m};
            ${ee?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (nBlocksPerCol + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${ae}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            `;for(let H=0;H<m*_;H++)J+=`
            let scale${H} = ${oe.getByOffset("col_index * nBlocksPerCol + block")};
            ${ee?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            zero_point_word = ${ee.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${H} = ${ae}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:""}
            col_index += 1;`;return J},K=()=>{let J=`col_index = col * ${m};`;for(let H=0;H<m*_;H++)J+=`
            let b${H}_data = ${W.getByIndices(`${W.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return J+=`
            var b_value: u32;
            let b_mask: u32 = ${t.bits===2?"0x03030303u":"0x0F0F0F0Fu"};
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${ce};
            var b_dequantized_values: ${ce};`,J};return`
        var<workgroup> workgroup_shared: array<${ke.type.value}, ${_*w}>;
        ${B.declareVariables(...X,ke)}
        ${B.mainStart([w,1,1])}
          let output_indices = ${ke.offsetToIndices(`(global_idx / ${w}) * ${_}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${w}) {
            //process one block
            var word_offset: u32 = block * ${t.blockSize/d};
            ${G()}
            for (var word: u32 = 0; word < ${l}; word += ${h}) {
              ${K()}
              for (var i: u32 = 0; i < ${h}; i++) {
                ${Ce()}
                word_offset += ${Qe/d};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${_}) {
            var output_value: ${ke.type.value} = ${ke.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${w}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${_};
            }
            ${ke.setByIndices(`${ke.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${t.blockSize};${t.bits};${d};${h};${m};${_};${w}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:f,dataType:p}],dispatchGroup:{x:b},programUniforms:y}),getShaderSource:C}},_d=(e,t)=>{let r=e[0].dims,i=r.length,a=r[i-2],n=t.k,s=t.n,o=r.slice(0,i-2),u=M.size(o),l=e[1].dims[2]/4,p=e[0].dataType,d=R(t.k),h=R(l),m=o.concat([a,s]),f=128,_=s%8===0?8:s%4===0?4:1,b=f/_,w=Math.floor(32/t.bits),y=b*h*w,x=y/d,S=y/t.blockSize,E=M.size(m)/_,C=[],B=[u,a,n/d],P=M.convertShape(e[1].dims).slice();P.splice(-1,1,l/h),C.push(...I(B)),C.push(...I(P)),C.push(...I(e[2].dims)),e.length===4&&C.push(...I(M.convertShape(e[3].dims)));let L=[u,a,s];C.push(...I(L));let W=oe=>{let X=B.length,ee=O("a",e[0].dataType,X,d),Ee=O("b",12,P.length,h),ke=O("scales",e[2].dataType,e[2].dims.length),ae=[ee,Ee,ke],ce=e.length===4?O("zero_points",12,e[3].dims.length):void 0;ce&&ae.push(ce);let Qe=L.length,j=q("output",e[0].dataType,Qe),Ce=A(e[0].dataType),G=()=>{switch(d){case 1:return`
          let a_data0 = vec4<${Ce}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${Ce}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${Ce}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${Ce}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw new Error(`${d}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${ee.type.value}, ${x}>;
        var<workgroup> inter_results: array<array<${j.type.value}, ${b}>, ${_}>;
        ${oe.declareVariables(...ae,j)}
        ${oe.mainStart([b,_,1])}
          let output_indices = ${j.offsetToIndices(`workgroup_index * ${_}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${S} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${x};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${x}; a_offset += ${f})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${ee.getByIndices(`${ee.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${ee.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${S} + local_id.x;
            ${ce?`
            let zero_point_values_per_byte: u32 = ${Math.floor(8/t.bits)}u;
            let zero_point_bytes_per_col = (n_blocks_per_col + zero_point_values_per_byte - 1u) / zero_point_values_per_byte;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block / zero_point_values_per_byte);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_sub_offset: u32 = block % zero_point_values_per_byte;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_sub_offset * ${t.bits}u);
            let zero_point_word = ${ce.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${Ce}((zero_point_word) & ${t.bits===2?"0x3u":"0xFu"});`:`
            // The default zero point is ${Math.pow(2,t.bits-1)} for unsigned ${t.bits}-bit quantization.
            let zero_point = ${Ce}(${Math.pow(2,t.bits-1).toFixed(1)});`}
            let scale = ${ke.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${Ee.getByIndices(`${Ee.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${t.blockSize/d};
            for (var i: u32 = 0; i < ${h}; i++) {
              let b_value = ${h===1?"b_data":"b_data[i]"};
              ${(()=>{let K=Math.floor(w/8),J="";for(let H=0;H<K;H++){let Re=H*t.bits*4,lr=Re+t.bits;J+=`
              ${G()}
              {${t.bits===2?`
                let half_word = b_value >> ${H*16}u;
                let byte_lo = half_word & 0xFFu;
                let byte_hi = (half_word >> 8u) & 0xFFu;
                let spread_word = (byte_lo & 0xFu) | ((byte_lo >> 4u) << 8u) | ((byte_hi & 0xFu) << 16u) | ((byte_hi >> 4u) << 24u);
                let b_value_lower = unpack4xU8(spread_word & 0x03030303u);
                let b_value_upper = unpack4xU8((spread_word >> 2u) & 0x03030303u);`:`
                let b_value_lower = unpack4xU8((b_value >> ${Re}u) & 0x0F0F0F0Fu);
                let b_value_upper = unpack4xU8((b_value >> ${lr}u) & 0x0F0F0F0Fu);`}
                let b_quantized_values = mat2x4<${Ce}>(${Array.from({length:4},(ot,Ht)=>`${Ce}(b_value_lower[${Ht}]), ${Ce}(b_value_upper[${Ht}])`).join(", ")});
                let b_dequantized_values = (b_quantized_values - mat2x4<${Ce}>(${Array(8).fill("zero_point").join(",")})) * scale;
                inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(ot,Ht)=>`${`dot(a_data${Ht}, b_dequantized_values[${Ht}])`}`).join(" + ")};
              }
              word_offset += ${8/d};`}return J})()}
            }
            workgroupBarrier();
          }

          if (local_idx < ${_}) {
            var output_value: ${j.type.value} = ${j.type.value}(0);
            for (var b = 0u; b < ${b}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${j.setByIndices(`${j.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${t.blockSize};${d};${h};${b};${_}`,inputDependencies:Array(e.length).fill("rank")},getRunData:()=>({outputs:[{dims:m,dataType:p}],dispatchGroup:{x:E},programUniforms:C}),getShaderSource:W}},wd=(e,t)=>{gd(e.inputs,t),t.blockSize===32&&e.adapterInfo.isVendor("intel")&&e.adapterInfo.isArchitecture("gen-12lp")?e.compute(_d(e.inputs,t)):e.compute(yd(e.inputs,t))},$d=e=>g(e)}),bd,vd,xd,Sd,Td,Ed,kd,Id,zd,rh=z(()=>{"use strict";le(),re(),Q(),bd=e=>{if(!e||e.length<1)throw new Error("Too few inputs");if(e[0].dataType!==1&&e[0].dataType!==10)throw new Error("Input type must be float or float16.");if(e.length>=2){let t=e[0].dims.length*2===e[1].dims[0];if(e.length===4&&(t=e[3].dims[0]*2===e[1].dims[0]),!t)throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},vd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
            k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${D("uniforms.x_shape",a,t)})) {
              break;
            }
            offset += k * i32(${D("uniforms.x_strides",a,t)});
        `;return`
          value = ${e.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${i}
            value = x[offset];
          }
      `},xd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${D("uniforms.x_shape",a,t)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${D("uniforms.x_shape",a,t)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${D("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},Sd=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${D("uniforms.x_shape",a,t)})) {
                  k = i32(${D("uniforms.x_shape",a,t)}) - 1;
                }
                offset += k * i32(${D("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},Td=(e,t,r)=>{let i="";for(let a=t-1;a>=0;--a)i+=`
                k = i32(${e.indicesGet("indices",a)}) - ${D("uniforms.pads",a,r)};
                if (k < 0)  {
                  k += i32(${D("uniforms.x_shape",a,t)}]);
                }
                if (k >= i32(${D("uniforms.x_shape",a,t)})) {
                  k -= i32(${D("uniforms.x_shape",a,t)});
                }
                offset += k * i32(${D("uniforms.x_strides",a,t)});
            `;return`
              var offset = 0;
              var k = 0;
              ${i}
              value = x[offset];
          `},Ed=(e,t,r)=>{switch(r.mode){case 0:return vd(e,t,r.pads.length);case 1:return xd(e,t,r.pads.length);case 2:return Sd(e,t,r.pads.length);case 3:return Td(e,t,r.pads.length);default:throw new Error("Invalid mode")}},kd=(e,t)=>{let r=M.padShape(e[0].dims.slice(),t.pads),i=e[0].dims,a=M.size(r),n=[{type:12,data:a},{type:6,data:t.pads}],s=e.length>=3&&e[2].data;t.mode===0&&n.push({type:s?e[2].dataType:1,data:t.value}),n.push(...I(e[0].dims,r));let o=["rank"],u=l=>{let p=q("output",e[0].dataType,r.length),d=O("x",e[0].dataType,i.length),h=d.type.value,m=Ed(p,i.length,t),f=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:t.pads.length}];return t.mode===0&&f.push({name:"constant_value",type:s?h:"f32"}),`
            ${l.registerUniforms(f).declareVariables(d,p)}
            ${l.mainStart()}
            ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${p.offsetToIndices("global_idx")};

            var value = ${h}(0);
            ${m}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${t.mode}${s}`,inputDependencies:o},getRunData:()=>({outputs:[{dims:r,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(M.size(r)/64)},programUniforms:n}),getShaderSource:u}},Id=(e,t)=>{if(e.length>1){let r=e[1].getBigInt64Array(),i=e.length>=3&&e[2].data?e[2].dataType===10?e[2].getUint16Array()[0]:e[2].getFloat32Array()[0]:0,a=e[0].dims.length,n=new Int32Array(2*a).fill(0);if(e.length>=4){let o=e[3].getBigInt64Array();for(let u=0;u<o.length;u++)n[Number(o[u])]=Number(r[u]),n[Number(o[u])+a]=Number(r[u+o.length])}else r.forEach((o,u)=>n[Number(u)]=Number(o));let s=[];return n.forEach(o=>s.push(o)),{mode:t.mode,value:i,pads:s}}else return t},zd=(e,t)=>{bd(e.inputs);let r=Id(e.inputs,t);e.compute(kd(e.inputs,r),{inputs:[0]})}}),wa,jn,Hn,Kn,Zn,Cd,Od,Qn,Xn,Ad,Rd,Yn,Bd,Md,Jn,Dd,Pd,Ud,Nd,ih=z(()=>{"use strict";Je(),le(),re(),Q(),wa=e=>{if(te.webgpu.validateInputContent&&(!e||e.length!==1))throw new Error("Pool ops requires 1 input.")},jn=(e,t,r)=>{let i=t.format==="NHWC",a=e.dims.slice();i&&a.splice(1,0,a.pop());let n=Object.hasOwnProperty.call(t,"dilations"),s=t.kernelShape.slice(),o=t.strides.slice(),u=n?t.dilations.slice():[],l=t.pads.slice();pr.adjustPoolAttributes(r,a,s,o,u,l);let p=pr.computePoolOutputShape(r,a,o,u,s,l,t.autoPad,t.ceilMode),d=Object.assign({},t);n?Object.assign(d,{kernelShape:s,strides:o,pads:l,dilations:u,cacheKey:t.cacheKey}):Object.assign(d,{kernelShape:s,strides:o,pads:l,cacheKey:t.cacheKey});let h=p.slice();return h.push(h.splice(1,1)[0]),[d,i?h:p]},Hn=(e,t)=>{let r=t.format==="NHWC",i=M.size(e),a=M.size(t.kernelShape),n=[{type:12,data:i},{type:12,data:a}],s=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(t.kernelShape.length<=2){let o=t.kernelShape[t.kernelShape.length-1],u=t.strides[t.strides.length-1],l=t.pads[t.pads.length/2-1],p=t.pads[t.pads.length-1],d=!!(l+p);n.push({type:12,data:o},{type:12,data:u},{type:12,data:l},{type:12,data:p}),s.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let h=!1;if(t.kernelShape.length===2){let m=t.kernelShape[t.kernelShape.length-2],f=t.strides[t.strides.length-2],_=t.pads[t.pads.length/2-2],b=t.pads[t.pads.length-2];h=!!(_+b),n.push({type:12,data:m},{type:12,data:f},{type:12,data:_},{type:12,data:b}),s.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[n,s,!0,d,h]}else{if(r)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let o=M.computeStrides(t.kernelShape);n.push({type:12,data:o},{type:12,data:t.pads},{type:12,data:t.strides}),s.push({name:"kernelStrides",type:"u32",length:o.length},{name:"pads",type:"u32",length:t.pads.length},{name:"strides",type:"u32",length:t.strides.length});let u=t.pads.reduce((l,p)=>l+p);return[n,s,!!u,!1,!1]}},Kn=(e,t,r,i,a,n,s,o,u,l,p,d)=>{let h=a.format==="NHWC",m=t.type.value,f=q("output",t.type.tensor,i);if(a.kernelShape.length<=2){let _="",b="",w="",y=r-(h?2:1);if(p?_=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${y}] = indices[${y}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${y}] < 0 || xIndices[${y}]
                      >= uniforms.x_shape[${y}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${n}
                }`:_=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${y}] = indices[${y}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${t.indicesToOffset("xIndices")}];
                  ${n}
                }`,a.kernelShape.length===2){let x=r-(h?3:2);d?b=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${x}] = indices[${x}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${x}] < 0 || xIndices[${x}] >= uniforms.x_shape[${x}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:b=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${x}] = indices[${x}] * uniforms.sh - uniforms.phStart + j;
                `,w=`
              }
            `}return`
            ${e.registerUniforms(u).declareVariables(t,f)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${f.offsetToIndices("global_idx")};
              var xIndices = ${f.offsetToIndices("global_idx")};

              var value = ${m}(${o});
              var pad = 0;
              ${b}
              ${_}
              ${w}
              ${s}

              output[global_idx] = value;
            }`}else{if(h)throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let _=a.kernelShape.length,b=a.pads.length,w="";return l?w=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${t.indicesToOffset("xIndices")}];
                ${n}
              }`:w=`
              }
              let x_val = x[${t.indicesToOffset("xIndices")}];
              ${n}
            `,`
            ${e.registerUniforms(u).declareVariables(t,f)}

            ${e.mainStart()}
              ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${f.offsetToIndices("global_idx")};
              var xIndices = ${f.offsetToIndices("global_idx")};

              var offsets: array<u32, ${_}>;

              var value = ${m}(${o});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${_-1}u; j++) {
                  offsets[j] = offset / ${D("uniforms.kernelStrides","j",_)};
                  offset -= offsets[j] * ${D("uniforms.kernelStrides","j",_)};
                }
                offsets[${_-1}] = offset;

                isPad = false;
                for (var j = ${r-_}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${D("uniforms.strides",`j - ${r-_}u`,_)}
                    + offsets[j - ${r-_}u] - ${D("uniforms.pads","j - 2u",b)};
                  ${w}
              }
              ${s}

              output[global_idx] = value;
            }`}},Zn=e=>`${e.format};${e.ceilMode};${e.autoPad};${e.kernelShape.length}`,Cd=e=>`${Zn(e)};${e.countIncludePad}`,Od=e=>`${Zn(e)};${e.storageOrder};${e.dilations}`,Qn=e=>({format:e.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][e.auto_pad],ceilMode:e.ceil_mode,kernelShape:e.kernel_shape,strides:e.strides,pads:e.pads}),Xn=(e,t,r,i)=>{let[a,n]=jn(t,i,r),s=O("x",t.dataType,t.dims.length),o=s.type.value,u="value += x_val;",l="";a.countIncludePad?l+=`value /= ${o}(uniforms.kernelSize);`:l+=`value /= ${o}(i32(uniforms.kernelSize) - pad);`;let[p,d,h,m,f]=Hn(n,a);p.push(...I(t.dims,n));let _=["rank"];return{name:e,shaderCache:{hint:`${i.cacheKey};${h};${m};${f}`,inputDependencies:_},getRunData:()=>({outputs:[{dims:n,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(M.size(n)/64)},programUniforms:p}),getShaderSource:b=>Kn(b,s,t.dims.length,n.length,a,u,l,0,d,h,m,f)}},Ad=e=>{let t=e.count_include_pad!==0,r=Qn(e);if(r.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding/divisor) is not yet implemented in the WebGPU AveragePool kernel");let i={countIncludePad:t,...r,cacheKey:""};return{...i,cacheKey:Cd(i)}},Rd=(e,t)=>{wa(e.inputs),e.compute(Xn("AveragePool",e.inputs[0],!1,t))},Yn={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},Bd=e=>{let t=e.format;return{format:t,...Yn,cacheKey:t}},Md=(e,t)=>{wa(e.inputs),e.compute(Xn("GlobalAveragePool",e.inputs[0],!0,t))},Jn=(e,t,r,i)=>{let[a,n]=jn(t,i,r),s=`
      value = max(x_val, value);
    `,o="",u=O("x",t.dataType,t.dims.length),l=["rank"],[p,d,h,m,f]=Hn(n,a);return p.push(...I(t.dims,n)),{name:e,shaderCache:{hint:`${i.cacheKey};${h};${m};${f}`,inputDependencies:l},getRunData:()=>({outputs:[{dims:n,dataType:t.dataType}],dispatchGroup:{x:Math.ceil(M.size(n)/64)},programUniforms:p}),getShaderSource:_=>Kn(_,u,t.dims.length,n.length,a,s,o,t.dataType===10?-65504:-1e5,d,h,m,f)}},Dd=(e,t)=>{wa(e.inputs),e.compute(Jn("MaxPool",e.inputs[0],!1,t))},Pd=e=>{let t=e.storage_order,r=e.dilations,i=Qn(e);if(t!==0)throw new Error("column major storage order is not yet supported for MaxPool");if(i.ceilMode!==0)throw new Error("ceil_mode output-shape is computed, but ceil_mode kernel execution (padding) is not yet implemented in the WebGPU MaxPool kernel");let a={storageOrder:t,dilations:r,...i,cacheKey:""};return{...a,cacheKey:Od(a)}},Ud=e=>{let t=e.format;return{format:t,...Yn,cacheKey:t}},Nd=(e,t)=>{wa(e.inputs),e.compute(Jn("GlobalMaxPool",e.inputs[0],!0,t))}}),Ld,Vd,Fd,qd,ah=z(()=>{"use strict";le(),re(),$(),Q(),Ld=(e,t)=>{if(e.length<2||e.length>3)throw new Error("DequantizeLinear requires 2 or 3 inputs.");if(e.length===3&&e[1].dims===e[2].dims)throw new Error("x-scale and x-zero-point must have the same shape.");if(e.length===3&&e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==0&&e[1].dims.length!==1&&e[1].dims.length!==e[0].dims.length)throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(e.length>2){if(e[0].dataType!==e[2].dataType)throw new Error("x and x-zero-point must have the same data type.");if(e[1].dims.length!==e[2].dims.length)throw new Error("scale and zero-point inputs must have the same rank.");if(!e[1].dims.map((r,i)=>r===e[2].dims[i]).reduce((r,i)=>r&&i,!0))throw new Error("scale and zero-point inputs must have the same shape.")}if(t.blockSize>0){if(e[1].dims.length===0||e[1].dims.length===1&&e[1].dims[0]===1)throw new Error("blockSize must be set only for block quantization.");if(!e[1].dims.map((a,n)=>n===t.axis||a===e[0].dims[n]).reduce((a,n)=>a&&n,!0))throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");if(e[1].dims.length!==e[0].dims.length)throw new Error("For block qunatization the scale input rank must be the same as the x rank.");let r=e[0].dims[t.axis],i=e[1].dims[t.axis];if(t.blockSize<Math.ceil(r/i)||t.blockSize>Math.ceil(r/(i-1)-1))throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},Vd=(e,t)=>{let r=M.normalizeAxis(t.axis,e[0].dims.length),i=e[0].dataType,a=i===3,n=e[0].dims,s=e[1].dataType,o=M.size(n),u=i===3||i===2,l=u?[Math.ceil(M.size(e[0].dims)/4)]:e[0].dims,p=e[1].dims,d=e.length>2?e[2]:void 0,h=d?u?[Math.ceil(M.size(d.dims)/4)]:d.dims:void 0,m=p.length===0||p.length===1&&p[0]===1,f=m===!1&&p.length===1,_=R(o),b=m&&(!u||_===4),w=b?_:1,y=b&&!u?_:1,x=O("input",u?12:i,l.length,y),S=O("scale",s,p.length),E=d?O("zero_point",u?12:i,h.length):void 0,C=q("output",s,n.length,w),B=[x,S];E&&B.push(E);let P=[l,p];d&&P.push(h);let L=[{type:12,data:o/w},{type:12,data:r},{type:12,data:t.blockSize},...I(...P,n)],W=oe=>{let X=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${oe.registerUniforms(X).declareVariables(...B,C)}
      ${oe.mainStart()}
          ${oe.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${C.offsetToIndices("global_idx")};

          // Set input x
          ${u?`
            let input = ${x.getByOffset("global_idx / 4")};
            let x_vec = ${a?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${w===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${x.getByOffset("global_idx")};`};

          // Set scale input
          ${m?`let scale_value= ${S.getByOffset("0")}`:f?`
            let scale_index = ${C.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${S.getByOffset("scale_index")};`:`
            var scale_indices: ${S.type.indices} = output_indices;
            let index = ${S.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${S.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${S.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${E?m?u?`
                let zero_point_input = ${E.getByOffset("0")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${E.getByOffset("0")}`:f?u?`
                let zero_point_index = ${C.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${E.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${C.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${E.getByOffset("zero_point_index")};`:u?`
                let zero_point_offset = ${S.indicesToOffset("scale_indices")};
                let zero_point_input = ${E.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${a?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${E.getByIndices("scale_indices")};`:`let zero_point_value = ${u?a?"i32":"u32":x.type.value}(0);`};
      // Compute and write output
      ${C.setByOffset("global_idx",`${C.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:t.cacheKey,inputDependencies:E?["rank","rank","rank"]:["rank","rank"]},getShaderSource:W,getRunData:()=>({outputs:[{dims:n,dataType:s}],dispatchGroup:{x:Math.ceil(o/w/64),y:1,z:1},programUniforms:L})}},Fd=(e,t)=>{Ld(e.inputs,t),e.compute(Vd(e.inputs,t))},qd=e=>g({axis:e.axis,blockSize:e.blockSize})}),Gd,Wd,jd,nh=z(()=>{"use strict";Je(),le(),Q(),Gd=(e,t,r)=>{let i=e===t,a=e<t&&r<0,n=e>t&&r>0;if(i||a||n)throw new Error("Range these inputs' contents are invalid.")},Wd=(e,t,r,i)=>{let a=Math.abs(Math.ceil((t-e)/r)),n=[a],s=a,o=[{type:12,data:s},{type:i,data:e},{type:i,data:r},...I(n)],u=l=>{let p=q("output",i,n.length),d=p.type.value,h=[{name:"outputSize",type:"u32"},{name:"start",type:d},{name:"delta",type:d}];return`
        ${l.registerUniforms(h).declareVariables(p)}
        ${l.mainStart()}
        ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${d}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${i}`},getShaderSource:u,getRunData:()=>({outputs:[{dims:n,dataType:i}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:o})}},jd=e=>{let t=0,r=0,i=0;e.inputs[0].dataType===6?(t=e.inputs[0].getInt32Array()[0],r=e.inputs[1].getInt32Array()[0],i=e.inputs[2].getInt32Array()[0]):e.inputs[0].dataType===1&&(t=e.inputs[0].getFloat32Array()[0],r=e.inputs[1].getFloat32Array()[0],i=e.inputs[2].getFloat32Array()[0]),te.webgpu.validateInputContent&&Gd(t,r,i),e.compute(Wd(t,r,i,e.inputs[0].dataType),{inputs:[]})}}),Hd,Kd,Zd,Qd,sh=z(()=>{"use strict";le(),re(),$(),Q(),Hd=(e,t,r,i)=>{if(e!=="none"&&i!=="i32"&&i!=="u32"&&i!=="f32")throw new Error(`Input ${i} is not supported with reduction ${e}.`);let a=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,n=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${t}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(e){case"none":return`${t}=${r};`;case"add":return i==="i32"||i==="u32"?`atomicAdd(&${t}, bitcast<${i}>(${r}));`:`
              ${a}bitcast<${i}>(oldValue) + (${r})${n}`;case"max":return i==="i32"||i==="u32"?`atomicMax(&${t}, bitcast<${i}>(${r}));`:`
                ${a}max(bitcast<f32>(oldValue), (${r}))${n}`;case"min":return i==="i32"||i==="u32"?`atomicMin(&${t}, bitcast<${i}>(${r}));`:`${a}min(bitcast<${i}>(oldValue), (${r}))${n}`;case"mul":return`${a}(bitcast<${i}>(oldValue) * (${r}))${n}`;default:throw new Error(`Reduction ${e} is not supported.`)}},Kd=(e,t)=>{let r=e[0].dims,i=e[1].dims,a=r,n=1,s=Math.ceil(M.sizeToDimension(i,i.length-1)/n),o=i[i.length-1],u=M.sizeFromDimension(r,o),l=[{type:12,data:s},{type:12,data:o},{type:12,data:u},...I(e[1].dims,e[2].dims,a)],p=d=>{let h=O("indices",e[1].dataType,e[1].dims.length),m=O("updates",e[2].dataType,e[2].dims.length,n),f=t.reduction!=="none"&&t.reduction!==""?Pe("output",e[0].dataType,a.length):q("output",e[0].dataType,a.length,n);return`
      ${d.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(h,m,f)}
      ${d.mainStart()}
        ${d.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${e[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${Hd(t.reduction,"output[data_offset + i]","value",f.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${t.cacheKey}_${t.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(s/64)},programUniforms:l}),getShaderSource:p}},Zd=e=>g({reduction:e.reduction}),Qd=(e,t)=>{e.compute(Kd(e.inputs,t),{inputs:[e.inputs[1],e.inputs[2]],outputs:[]})}}),Xd,Yd,Jd,es,ep,tp,rp,ip,ap,np,sp,op,ts,up,lp,dp,pp,cp,hp,fp,oh=z(()=>{"use strict";le(),re(),$(),Q(),Xd=(e,t)=>{if(e.every(r=>r>0||(()=>{throw new Error("Resize requires scales input values to be positive")})),e.length>0){if(t.mode==="linear"){if(!(e.length===2||e.length===3||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1||e.length===5&&e[0]===1&&e[1]===1))throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(t.mode==="cubic"&&!(e.length===2||e.length===4&&e[0]===1&&e[1]===1||e.length===4&&e[0]===1&&e[3]===1))throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},Yd=(e,t,r)=>{t.every(a=>a>=0&&a<r||(()=>{throw new Error("Resize requires axes input values to be positive and less than rank")}));let i=new Array(r).fill(1);return t.forEach((a,n)=>i[a]=e[n]),i},Jd=(e,t,r,i,a,n)=>{let[s,o,u]=r>10?[1,2,3]:[-1,e.length>1?1:-1,-1],l=e[0].dims.length;if(s>0&&e.length>s&&e[s].dims.length>0)e[s].getFloat32Array().forEach(p=>n.push(p));else if(t.coordinateTransformMode==="tf_crop_and_resize")throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(o>0&&e.length>o&&e[o].dims.length===1&&e[o].dims[0]>0){if(e[o].getFloat32Array().forEach(p=>i.push(p)),i.length!==0&&i.length!==l&&r>=18&&i.length!==t.axes.length)throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");Xd(i,t),t.axes.length>0&&Yd(i,t.axes,l).forEach((p,d)=>i[d]=p)}if(u>0&&e.length>u&&e[u].dims.length===1&&e[u].dims[0]>0&&(e[u].getBigInt64Array().forEach(p=>a.push(Number(p))),a.length!==0&&a.length!==l&&r>=18&&a.length!==t.axes.length))throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(t.axes.length>0){if(i.length!==0&&i.length!==t.axes.length)throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(a.length!==0&&a.length!==t.axes.length)throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof i<"u"&&typeof a<"u"&&i.length>0&&a.length>l)throw new Error("Resize requires only of scales or sizes to be specified")},es=(e,t,r,i)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${e}) * (${t});
  let whole = ${i}(big / (${r}));
  let fract = ${i}(big % (${r})) / ${i}(${r});
  return whole + fract;
`,ep=(e,t)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${t} { `+(()=>{switch(e){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${t}(xResized) / ${t}(xScale);
          } else {
            ${es("xResized","lengthOriginal","lengthResized",t)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${t}(xResized) + 0.5) / ${t}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${t}(xResized) + 0.5) / ${t}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${es("xResized","lengthOriginal - 1","lengthResized - 1",t)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${t}(roiStart) * ${t}(lengthOriginal - 1) +
                        (${t}(xResized) * ${t}(roiEnd - roiStart) * ${t}(lengthOriginal - 1)) /
                        ${t}(lengthResized - 1);
                  } else {
                    return 0.5 * ${t}(roiStart + roiEnd) * ${t}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${t}xScale * ${t}(lengthResized);
                  const adjustment = ${t}(lengthResized) / outputWidth;
                  const center = ${t}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;case"half_pixel":return`return ((${t}(xResized) + 0.5) / ${t}(xScale)) - 0.5;`;default:throw new Error(`Coordinate transform mode ${e} is not supported`)}})()+"}",tp=(e,t,r)=>`fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {`+(()=>{switch(e){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";default:if(t<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw new Error(`Nearest mode ${e} is not supported`)}})()+"}",rp=(e,t,r)=>{let i=new Array(r).fill(0).concat(new Array(r).fill(1)),a=e.length===0?i:e.slice();return t.length>0?(t.forEach((n,s)=>{i[n]=a[s],i[s+r]=a[t.length+s]}),i):a},ip=(e,t,r,i)=>{let a=[];if(r.length>0)if(i.length>0){if(e.forEach(n=>a.push(n)),Math.max(...i)>e.length)throw new Error("axes is out of bound");i.forEach((n,s)=>a[n]=r[s])}else r.forEach(n=>a.push(n));else{if(t.length===0)throw new Error("Resize requires either scales or sizes.");a=e.map((n,s)=>Math.round(n*t[s]))}return a},ap=(e,t,r)=>{let i=(()=>{switch(r.keepAspectRatioPolicy){case"not_larger":return r.axes.length>0?Math.min(...r.axes.map(n=>t[n]),Number.MAX_VALUE):Math.min(...t,Number.MAX_VALUE);case"not_smaller":return r.axes.length>0?Math.max(...r.axes.map(n=>t[n]),Number.MIN_VALUE):Math.max(...t,Number.MIN_VALUE);default:throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`)}})();t.fill(1,0,t.length);let a=e.slice();return r.axes.length>0?(r.axes.forEach(n=>t[n]=i),r.axes.forEach(n=>a[n]=Math.round(e[n]*t[n]))):(t.fill(i,0,t.length),a.forEach((n,s)=>a[s]=Math.round(n*t[s]))),a},np=(e,t,r,i,a)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> array<${e.type.value}, ${r.length}> {
      var original_indices: array<${e.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${e.indicesGet("output_indices","i")};
        var scale = ${D("uniforms.scales","i",i)};
        var roi_low = ${D("uniforms.roi","i",a)};
        var roi_hi = ${D("uniforms.roi",`i + ${t.length}`,a)};
        if (scale == 1.0) {
          original_indices[i] = ${e.type.value}(output_index);
        } else {
          var input_shape_i = ${D("uniforms.input_shape","i",t.length)};
          var output_shape_i = ${D("uniforms.output_shape","i",r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,sp=(e,t,r,i,a,n,s)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
      var input_indices: ${e.type.indices};
      for (var i:u32 = 0; i < ${i.length}; i++) {
        var output_index = ${t.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${D("uniforms.scales","i",a)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${D("uniforms.roi","i",n)};
          var roi_hi = ${D("uniforms.roi",`i + ${r.length}`,n)};
          var input_shape_i = ${D("uniforms.input_shape","i",r.length)};
          var output_shape_i = ${D("uniforms.output_shape","i",i.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${s} || (original_idx >= 0 && original_idx < ${t.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${t.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${e.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,op=(e,t)=>`
    fn checkInputIndices(input_indices: ${e.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${t.length}; i++) {
        var input_index = ${e.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${D("uniforms.input_shape","i",t.length)}) {
          return false;
        }
      }
      return true;
    }`,ts=(e,t,r,i)=>e.rank>i?`
    ${e.indicesSet("input_indices",t,"channel")};
    ${e.indicesSet("input_indices",r,"batch")};
`:"",up=(e,t,r,i,a)=>{let[n,s,o,u]=r.length===2?[-1,0,1,-1]:[0,2,3,1],l=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${l} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(row, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(col, ${r[o]} - 1))`)};
      ${ts(e,u,n,2)}
      return ${e.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${t.type.indices}) -> ${l} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${l} = originalIndices[${s}];
      var col:${l} = originalIndices[${o}];
      ${i?`if (row < 0 || row > (${r[s]} - 1) || col < 0 || col > (${r[o]} - 1)) {
        return ${a};
      }`:""};
      row = max(0, min(row, ${r[s]} - 1));
      col = max(0, min(col, ${r[o]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length>2?`u32(originalIndices[${u}])`:"0"};
      var batch: u32 =  ${r.length>2?`u32(originalIndices[${n}])`:"0"};
      var x11: ${l} = getInputValue(batch, channel, row1, col1);
      var x12: ${l} = getInputValue(batch, channel, row1, col2);
      var x21: ${l} = getInputValue(batch, channel, row2, col1);
      var x22: ${l} = getInputValue(batch, channel, row2, col2);
      var dx1: ${l} = abs(row - ${l}(row1));
      var dx2: ${l} = abs(${l}(row2) - row);
      var dy1: ${l} = abs(col - ${l}(col1));
      var dy2: ${l} = abs(${l}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},lp=(e,t,r,i,a,n,s,o,u,l)=>{let p=r.length===2,d=!0,[h,m]=p?[0,1]:d?[2,3]:[1,2],f=e.type.value,_=b=>{let w=b===h?"row":"col";return`
      fn ${w}CubicInterpolation(input_indices: ${e.type.indices}, output_indices: ${t.type.indices}) -> ${f} {
        var output_index = ${t.indicesGet("output_indices",b)};
        var originalIdx: ${f} = getOriginalCoordinateFromResizedCoordinate(output_index, ${a[b]},
        ${i[b]}, ${r[b]}, ${n[b]}, ${n[b]} + ${r.length});
        var fractOriginalIdx: ${f} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${o} && (originalIdx < 0 || originalIdx > (${r[b]} - 1))) {
          return ${u};
        }
        var data: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${w}: ${f} = originalIdx + ${f}(i);
          if (${w} < 0 || ${w} >= ${r[b]}) {
            ${l?`coefs[i + 1] = 0.0;
                        continue;`:o?`return ${u};`:`${w} = max(0, min(${w}, ${r[b]} - 1));`};
          }
        var input_indices_copy: ${e.type.indices} = input_indices;
          ${e.indicesSet("input_indices_copy",b,`u32(${w})`)};
          data[i + 1] = ${b===h?e.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${_(h)};
    ${_(m)};
  fn getCubicInterpolationCoefs(s: ${f}) -> array<${f}, 4> {
    var absS = abs(s);
    var coeffs: array<${f}, 4> = array<${f}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${f} = 1.0 - absS;
    var twoMinusAbsS: ${f} = 2.0 - absS;
    var onePlusAbsS: ${f} = 1.0 + absS;
    coeffs[0] = ((${s} * onePlusAbsS - 5 * ${s}) * onePlusAbsS + 8 * ${s}) * onePlusAbsS - 4 * ${s};
    coeffs[1] = ((${s} + 2) * absS - (${s} + 3)) * absS * absS + 1;
    coeffs[2] = ((${s} + 2) * oneMinusAbsS - (${s} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${s} * twoMinusAbsS - 5 * ${s}) * twoMinusAbsS + 8 * ${s}) * twoMinusAbsS - 4 * ${s};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${f}, 4>, coefs: array<${f}, 4>) -> ${f} {
    var coefsSum: ${f} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${t.type.indices}) -> ${f} {
    var input_indices: ${e.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},dp=(e,t,r,i,a)=>{let[n,s,o,u,l]=r.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],p=e.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${p} {
      var input_indices: ${e.type.indices};
      ${e.indicesSet("input_indices",s,`max(0, min(depth, ${r[s]} - 1))`)};
      ${e.indicesSet("input_indices",o,`max(0, min(height, ${r[o]} - 1))`)};
      ${e.indicesSet("input_indices",u,`max(0, min(width, ${r[u]} - 1))`)};
      ${ts(e,l,n,3)}
      return ${e.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${t.type.indices}) -> ${p} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${p} = originalIndices[${s}];
      var height:${p} = originalIndices[${o}];
      var width:${p} = originalIndices[${u}];
      ${i?`if (depth < 0 || depth > (${r[s]} - 1) || height < 0 || height > (${r[o]} - 1) || width < 0 || (width > ${r[u]} - 1)) {
      return ${a};
        }`:""};

    depth = max(0, min(depth, ${r[s]} - 1));
      height = max(0, min(height, ${r[o]} - 1));
      width = max(0, min(width, ${r[u]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length>3?`u32(originalIndices[${l}])`:"0"};
      var batch: u32 =  ${r.length>3?`u32(originalIndices[${n}])`:"0"};

      var x111: ${p} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${p} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${p} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${p} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${p} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${p} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${p} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${p} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${p} = abs(depth - ${p}(depth1));
      var dx2: ${p} = abs(${p}(depth2) - depth);
      var dy1: ${p} = abs(height - ${p}(height1));
      var dy2: ${p} = abs(${p}(height2) - height);
      var dz1: ${p} = abs(width - ${p}(width1));
      var dz2: ${p} = abs(${p}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},pp=(e,t,r,i,a,n)=>{let s=e.dims,o=rp(n,t.axes,s.length),u=ip(s,i,a,t.axes),l=i.slice();i.length===0&&(l=s.map((y,x)=>y===0?1:u[x]/y),t.keepAspectRatioPolicy!=="stretch"&&(u=ap(s,l,t)));let p=q("output",e.dataType,u.length),d=O("input",e.dataType,s.length),h=M.size(u),m=s.length===u.length&&s.every((y,x)=>y===u[x]),f=t.coordinateTransformMode==="tf_crop_and_resize",_=t.extrapolationValue,b=d.type.value,w=y=>`
      ${m?"":`
      ${ep(t.coordinateTransformMode,b)};
      ${(()=>{switch(t.mode){case"nearest":return`
              ${op(d,s)};
              ${tp(t.nearestMode,r,b)};
              ${sp(d,p,s,u,l.length,o.length,f)};
              `;case"linear":return`
              ${np(p,s,u,l.length,o.length)};
              ${(()=>{if(s.length===2||s.length===4)return`${up(d,p,s,f,_)}`;if(s.length===3||s.length===5)return`${dp(d,p,s,f,_)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(s.length===2||s.length===4)return`${lp(d,p,s,u,l,o,t.cubicCoeffA,f,t.extrapolationValue,t.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${y.registerUniform("output_size","u32").registerUniform("scales","f32",l.length).registerUniform("roi","f32",o.length).declareVariables(d,p)}
      ${y.mainStart()}
        ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${m?"output[global_idx] = input[global_idx];":`
        let output_indices = ${p.offsetToIndices("global_idx")};
        var input_indices: ${d.type.indices};
        ${(()=>{switch(t.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${d.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${t.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${s.length===2||s.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${t.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${t.cacheKey}|${r}|${l.length>0?t.mode==="cubic"?l:l.length:""}|${a.length>0?a:""}|${o.length>0?o:""}|${m}|${t.mode==="nearest"?s.length:s}`,inputDependencies:["rank"]},getShaderSource:w,getRunData:()=>({outputs:[{dims:u,dataType:e.dataType}],dispatchGroup:{x:Math.ceil(h/64)},programUniforms:[{type:12,data:h},{type:1,data:l},{type:1,data:o},...I(s,u)]})}},cp=e=>{let t=e.customDataBuffer;return new Uint32Array(t.buffer,t.byteOffset,1)[0]},hp=(e,t)=>{let r=[],i=[],a=[],n=cp(e);if(t.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");Jd(e.inputs,t,n,r,i,a),e.compute(pp(e.inputs[0],t,n,r,i,a),{inputs:[0]})},fp=e=>{let t=e.antialias,r=e.axes,i=e.coordinateTransformMode,a=e.cubicCoeffA,n=e.excludeOutside!==0,s=e.extrapolationValue,o=e.keepAspectRatioPolicy,u=e.mode,l=e.nearestMode===""?"simple":e.nearestMode;return g({antialias:t,axes:r,coordinateTransformMode:i,cubicCoeffA:a,excludeOutside:n,extrapolationValue:s,keepAspectRatioPolicy:o,mode:u,nearestMode:l})}}),mp,gp,yp,uh=z(()=>{"use strict";le(),re(),Q(),mp=e=>{if(!e||e.length<3)throw new Error("layerNorm requires at least 3 inputs.");let t=e[0],r=e[1],i=e[2];if(t.dataType!==r.dataType||t.dataType!==i.dataType)throw new Error("All inputs must have the same data type");if(t.dims.length!==3&&t.dims.length!==2)throw new Error("Input must be 2D or 3D");if(r.dims.length!==3&&r.dims.length!==2)throw new Error("Skip must be 2D or 3D");let a=t.dims[t.dims.length-1],n=t.dims[t.dims.length-2];if(r.dims[r.dims.length-1]!==a)throw new Error("Skip must have the same hidden size as input");if(r.dims[r.dims.length-2]!==n)throw new Error("Skip must have the same sequence length as input");if(i.dims.length!==1)throw new Error("Gamma must be 1D");if(i.dims[i.dims.length-1]!==a)throw new Error("Gamma must have the same hidden size as input");if(e.length>3){let s=e[3];if(s.dims.length!==1)throw new Error("Beta must be 1D");if(s.dims[s.dims.length-1]!==a)throw new Error("Beta must have the same hidden size as input")}if(e.length>4){let s=e[4];if(s.dims.length!==1)throw new Error("Bias must be 1D");if(s.dims[s.dims.length-1]!==a)throw new Error("Bias must have the same hidden size as input")}},gp=(e,t,r,i)=>{let a=t.simplified,n=e[0].dims,s=M.size(n),o=n,u=s,l=n.slice(-1)[0],p=i?n.slice(0,-1).concat(1):[],d=!a&&e.length>3,h=e.length>4,m=i&&r>1,f=i&&r>2,_=r>3,b=64,w=R(l),y=[{type:12,data:u},{type:12,data:w},{type:12,data:l},{type:1,data:t.epsilon}],x=E=>{let C=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],B=[O("x",e[0].dataType,e[0].dims,w),O("skip",e[1].dataType,e[1].dims,w),O("gamma",e[2].dataType,e[2].dims,w)];d&&B.push(O("beta",e[3].dataType,e[3].dims,w)),h&&B.push(O("bias",e[4].dataType,e[4].dims,w)),B.push(q("output",e[0].dataType,o,w)),m&&B.push(q("mean_output",1,p)),f&&B.push(q("inv_std_output",1,p)),_&&B.push(q("input_skip_bias_sum",e[0].dataType,o,w));let P=A(e[0].dataType),L=A(1,w);return`

      ${E.registerUniforms(C).declareVariables(...B)}
      var<workgroup> sum_shared : array<${L}, ${b}>;
      var<workgroup> sum_squared_shared : array<${L}, ${b}>;

      ${E.mainStart([b,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${b};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${b};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${b-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${h?"bias[offset1d + i]":P+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${_?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${F(P,w,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${b};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${U("sum",w)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${U("square_sum",w)} / f32(uniforms.hidden_size) ${a?"":"- mean * mean"} + uniforms.epsilon);
        ${m?"mean_output[global_idx] = mean;":""}
        ${f?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${a?"":`- ${P}(mean)`}) *
            ${P}(inv_std_dev) * gamma[offset1d + i]
            ${d?"+ beta[offset1d + i]":""};
        }
      }`},S=[{dims:o,dataType:e[0].dataType}];return r>1&&S.push({dims:p,dataType:1}),r>2&&S.push({dims:p,dataType:1}),r>3&&S.push({dims:n,dataType:e[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${w};${m};${f};${_}`,inputDependencies:e.map((E,C)=>"type")},getShaderSource:x,getRunData:()=>({outputs:S,dispatchGroup:{x:Math.ceil(u/l)},programUniforms:y})}},yp=(e,t)=>{mp(e.inputs);let r=[0];e.outputCount>1&&r.push(-3),e.outputCount>2&&r.push(-3),e.outputCount>3&&r.push(3),e.compute(gp(e.inputs,t,e.outputCount,!1),{outputs:r})}}),_p,$a,wp,rs,$p,bp,vp,xp,lh=z(()=>{"use strict";le(),re(),$(),Q(),_p=(e,t)=>{if(!e||e.length<1)throw new Error("too few inputs");if(t.axes.length!==0){if(t.axes.length!==t.starts.length||t.axes.length!==t.ends.length)throw new Error("axes, starts and ends must have the same length")}else if(t.starts.length!==t.ends.length)throw new Error("starts and ends must have the same length");e.slice(1).forEach((r,i)=>{if(e[i+1].dataType!==6&&e[i+1].dataType!==7)throw new Error(`Input ${i} must be an array of int32 or int64`)})},$a=(e,t)=>{let r=[];if(e.length>t)if(e[t].dataType===7)e[t].getBigInt64Array().forEach(i=>r.push(Number(i)));else if(e[t].dataType===6)e[t].getInt32Array().forEach(i=>r.push(Number(i)));else throw new Error(`Input ${t} must be an array of int32 or int64`);return r},wp=(e,t)=>{if(e.length>1){let r=$a(e,1),i=$a(e,2),a=$a(e,3);return a.length===0&&(a=[...Array(e[0].dims.length).keys()]),g({starts:r,ends:i,axes:a})}else return t},rs=(e,t,r,i,a)=>{let n=e;return e<0&&(n+=r[i[t]]),a[t]<0?Math.max(0,Math.min(n,r[i[t]]-1)):Math.max(0,Math.min(n,r[i[t]]))},$p=(e,t,r)=>`fn calculateInputIndices(output_indices: ${t.type.indices}) -> ${e.type.indices} {
          var input_indices: ${e.type.indices};
          var carry = 0u;
          for (var i = ${r.length-1}; i >= 0; i--) {
            let input_shape_i = ${D("uniforms.input_shape","i",r.length)};
            let steps_i = ${D("uniforms.steps","i",r.length)};
            let signs_i = ${D("uniforms.signs","i",r.length)};
            let starts_i = ${D("uniforms.starts","i",r.length)};
            var output_index = ${t.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${e.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,bp=(e,t)=>{let r=e[0].dims,i=M.size(r),a=t.axes.length>0?M.normalizeAxes(t.axes,r.length):[...Array(r.length).keys()],n=$a(e,4);n.forEach(w=>w!==0||(()=>{throw new Error("step cannot be 0")})),n.length===0&&(n=Array(a.length).fill(1));let s=t.starts.map((w,y)=>rs(w,y,r,a,n)),o=t.ends.map((w,y)=>rs(w,y,r,a,n));if(a.length!==s.length||a.length!==o.length)throw new Error("start, ends and axes should have the same number of elements");if(a.length!==r.length)for(let w=0;w<r.length;++w)a.includes(w)||(s.splice(w,0,0),o.splice(w,0,r[w]),n.splice(w,0,1));let u=n.map(w=>Math.sign(w));n.forEach((w,y,x)=>{if(w<0){let S=(o[y]-s[y])/w,E=s[y],C=E+S*n[y];s[y]=C,o[y]=E,x[y]=-w}});let l=r.slice(0);a.forEach((w,y)=>{l[w]=Math.ceil((o[w]-s[w])/n[w])});let p={dims:l,dataType:e[0].dataType},d=q("output",e[0].dataType,l.length),h=O("input",e[0].dataType,e[0].dims.length),m=M.size(l),f=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:s.length},{name:"signs",type:"i32",length:u.length},{name:"steps",type:"u32",length:n.length}],_=[{type:12,data:m},{type:12,data:s},{type:6,data:u},{type:12,data:n},...I(e[0].dims,l)],b=w=>`
      ${w.registerUniforms(f).declareVariables(h,d)}
        ${$p(h,d,r)}
        ${w.mainStart()}
          ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${d.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${d.setByOffset("global_idx",h.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${u.length}_${s.length}_${n.length}`,inputDependencies:["rank"]},getShaderSource:b,getRunData:()=>({outputs:[p],dispatchGroup:{x:Math.ceil(i/64)},programUniforms:_})}},vp=(e,t)=>{_p(e.inputs,t);let r=wp(e.inputs,t);e.compute(bp(e.inputs,r),{inputs:[0]})},xp=e=>{let t=e.starts,r=e.ends,i=e.axes;return g({starts:t,ends:r,axes:i})}}),Sp,Tp,Ep,kp,dh=z(()=>{"use strict";le(),re(),$(),Nt(),Q(),Sp=e=>{if(!e||e.length!==1)throw new Error("Softmax op requires 1 input.")},Tp=(e,t)=>{let r=e.inputs[0],i=r.dims,a=M.size(i),n=i.length,s=M.normalizeAxis(t.axis,n),o=s<i.length-1,u,l=[];o?(l=Array.from({length:n},(B,P)=>P),l[s]=n-1,l[n-1]=s,u=e.compute(at(r,l),{inputs:[r],outputs:[-1]})[0]):u=r;let p=u.dims,d=p[n-1],h=a/d,m=R(d),f=d/m,_=64;h===1&&(_=256);let b=(B,P)=>P===4?`max(max(${B}.x, ${B}.y), max(${B}.z, ${B}.w))`:P===2?`max(${B}.x, ${B}.y)`:P===3?`max(max(${B}.x, ${B}.y), ${B}.z)`:B,w=O("x",u.dataType,u.dims,m),y=q("result",u.dataType,u.dims,m),x=w.type.value,S=A(u.dataType)==="f32"?`var threadMax = ${x}(-3.4028234663852886e+38f);`:`var threadMax = ${x}(-65504.0h);`,E=B=>`
      var<workgroup> rowMaxShared : ${x};
      var<workgroup> rowSumShared : ${x};
      var<workgroup> threadShared : array<${x}, ${_}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${x} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${x}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${B.registerUniform("packedCols","i32").declareVariables(w,y)}
      ${B.mainStart(_)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${_};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${S}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${x}(${b("threadShared[0]",m)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${x}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${x}(${U("threadShared[0]",m)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${x}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`,C=e.compute({name:"Softmax",shaderCache:{hint:`${m};${_}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:p,dataType:u.dataType}],dispatchGroup:{x:h},programUniforms:[{type:6,data:f}]}),getShaderSource:E},{inputs:[u],outputs:[o?-1:0]})[0];o&&e.compute(at(C,l),{inputs:[C]})},Ep=(e,t)=>{Sp(e.inputs),Tp(e,t)},kp=e=>g({axis:e.axis})}),is,Ip,zp,Cp,Op,ph=z(()=>{"use strict";le(),re(),Q(),is=e=>Array.from(e.getBigInt64Array(),Number),Ip=e=>{if(!e||e.length!==2)throw new Error("Tile requires 2 inputs.");if(e[0].dataType!==1&&e[0].dataType!==10&&e[0].dataType!==6&&e[0].dataType!==12)throw new Error("Tile only support float, float16, int32, and uint32 data types");if(e[1].dataType!==7)throw new Error("Tile `repeats` input should be of int64 data type");if(e[1].dims.length!==1)throw new Error("Tile `repeats` input should be 1-D");if(is(e[1]).length!==e[0].dims.length)throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},zp=(e,t)=>{let r=[];for(let i=0;i<e.length;++i)r.push(e[i]*t[i]);return r},Cp=(e,t)=>{let r=e[0].dims,i=t??is(e[1]),a=zp(r,i),n=M.size(a),s=e[0].dataType,o=O("input",s,r.length),u=q("output",s,a.length),l=p=>`
      const inputShape = ${o.indices(...r)};
      ${p.registerUniform("output_size","u32").declareVariables(o,u)}
      ${p.mainStart()}
      ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${u.offsetToIndices("global_idx")};
      var input_indices: ${o.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${o.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${u.indicesGet("output_indices","i")}  % input_dim_i;

        ${o.indicesSet("input_indices","i","input_dim_value")}
      }
      ${u.setByOffset("global_idx",o.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${i}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:a,dataType:e[0].dataType}],dispatchGroup:{x:Math.ceil(n/64)},programUniforms:[{type:12,data:n},...I(e[0].dims,a)]}),getShaderSource:l}},Op=e=>{Ip(e.inputs),e.compute(Cp(e.inputs),{inputs:[0]})}}),Ap,Rp,Bp,ch=z(()=>{"use strict";le(),re(),Q(),Ap=(e,t,r,i,a)=>{let n=q("output_data",a,r.length,4),s=O("a_data",t[1].dataType,t[1].dims.length,4),o=O("b_data",t[2].dataType,t[2].dims.length,4),u=O("c_data",t[0].dataType,t[0].dims.length,4),l,p=(d,h,m)=>`select(${h}, ${d}, ${m})`;if(!i)l=n.setByOffset("global_idx",p(s.getByOffset("global_idx"),o.getByOffset("global_idx"),u.getByOffset("global_idx")));else{let d=(h,m,f="")=>{let _=`a_data[index_a${m}][component_a${m}]`,b=`b_data[index_b${m}][component_b${m}]`,w=`bool(c_data[index_c${m}] & (0xffu << (component_c${m} * 8)))`;return`
            let output_indices${m} = ${n.offsetToIndices(`global_idx * 4u + ${m}u`)};
            let offset_a${m} = ${s.broadcastedIndicesToOffset(`output_indices${m}`,n)};
            let offset_b${m} = ${o.broadcastedIndicesToOffset(`output_indices${m}`,n)};
            let offset_c${m} = ${u.broadcastedIndicesToOffset(`output_indices${m}`,n)};
            let index_a${m} = offset_a${m} / 4u;
            let index_b${m} = offset_b${m} / 4u;
            let index_c${m} = offset_c${m} / 4u;
            let component_a${m} = offset_a${m} % 4u;
            let component_b${m} = offset_b${m} % 4u;
            let component_c${m} = offset_c${m} % 4u;
            ${h}[${m}] = ${f}(${p(_,b,w)});
          `};a===9?l=`
            var data = vec4<u32>(0);
            ${d("data",0,"u32")}
            ${d("data",1,"u32")}
            ${d("data",2,"u32")}
            ${d("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:l=`
            ${d("output_data[global_idx]",0)}
            ${d("output_data[global_idx]",1)}
            ${d("output_data[global_idx]",2)}
            ${d("output_data[global_idx]",3)}
          `}return`
        ${e.registerUniform("vec_size","u32").declareVariables(u,s,o,n)}
        ${e.mainStart()}
        ${e.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${l}
      }`},Rp=e=>{let t=e[1].dims,r=e[2].dims,i=e[0].dims,a=e[1].dataType,n=!(M.areEqual(t,r)&&M.areEqual(r,i)),s=t,o=M.size(t);if(n){let l=Xt.calcShape(Xt.calcShape(t,r,!1),i,!1);if(!l)throw new Error("Can't perform where op on the given tensors");s=l,o=M.size(s)}let u=Math.ceil(o/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:l=>Ap(l,e,s,n,a),getRunData:()=>({outputs:[{dims:s,dataType:a}],dispatchGroup:{x:Math.ceil(o/64/4)},programUniforms:[{type:12,data:u},...I(i,t,r,s)]})}},Bp=e=>{e.compute(Rp(e.inputs))}}),Mp,hh=z(()=>{"use strict";Ec(),fn(),kc(),Ic(),zc(),Cc(),Oc(),Dc(),Uc(),Nc(),Lc(),Vc(),Fc(),qc(),Gc(),Wc(),jc(),Hc(),Kc(),Zc(),Qc(),Xc(),Yc(),Jc(),eh(),th(),Hl(),rh(),ih(),ah(),nh(),sh(),pn(),oh(),id(),uh(),lh(),dh(),ed(),ph(),Nt(),_n(),ch(),Mp=new Map([["Abs",[no]],["Acos",[so]],["Acosh",[oo]],["Add",[Qo]],["ArgMax",[Gs,hn]],["ArgMin",[qs,hn]],["Asin",[uo]],["Asinh",[lo]],["Atan",[po]],["Atanh",[co]],["Attention",[Qs]],["AveragePool",[Rd,Ad]],["BatchNormalization",[eo]],["BiasAdd",[io]],["BiasSplitGelu",[Ho]],["Cast",[fo,ho]],["Ceil",[yo]],["Clip",[go]],["Concat",[du,pu]],["Conv",[On,zn]],["ConvTranspose",[Uu,Mu]],["Cos",[_o]],["Cosh",[wo]],["CumSum",[Lu,Vu]],["DepthToSpace",[Wu,ju]],["DequantizeLinear",[Fd,qd]],["DFT",[Ju,el]],["Div",[Xo]],["Einsum",[sl,ol]],["Elu",[$o,ha]],["Equal",[Yo]],["Erf",[bo]],["Exp",[vo]],["Expand",[pl]],["FastGelu",[hl]],["Floor",[xo]],["FusedConv",[On,zn]],["Gather",[yl,gl]],["GatherElements",[Il,kl]],["GatherBlockQuantized",[xl,Sl]],["GatherND",[wl,$l]],["Gelu",[So]],["Gemm",[Al,Ol]],["GlobalAveragePool",[Md,Bd]],["GlobalMaxPool",[Nd,Ud]],["Greater",[ru]],["GreaterOrEqual",[au]],["GridSample",[Vl,Fl]],["GroupQueryAttention",[od]],["HardSigmoid",[Ao,Oo]],["HardSwish",[Ro]],["InstanceNormalization",[dd]],["LayerNormalization",[hd]],["LeakyRelu",[To,ha]],["Less",[iu]],["LessOrEqual",[nu]],["Log",[Vo]],["MatMul",[md]],["MatMulNBits",[wd,$d]],["MaxPool",[Dd,Pd]],["Mul",[Jo]],["MultiHeadAttention",[jl,Gl]],["Neg",[ko]],["Not",[Eo]],["Pad",[zd]],["Pow",[eu]],["QuickGelu",[Go,ha]],["Range",[jd]],["Reciprocal",[Io]],["ReduceMin",[Us]],["ReduceMean",[Rs]],["ReduceMax",[Ps]],["ReduceSum",[Ls]],["ReduceProd",[Ns]],["ReduceL1",[Bs]],["ReduceL2",[Ms]],["ReduceLogSum",[Fs]],["ReduceLogSumExp",[Ds]],["ReduceSumSquare",[Vs]],["Relu",[zo]],["Resize",[hp,fp]],["RotaryEmbedding",[rd]],["ScatterND",[Qd,Zd]],["Sigmoid",[Co]],["Sin",[Bo]],["Sinh",[Mo]],["Slice",[vp,xp]],["SkipLayerNormalization",[yp]],["Split",[Yl,Jl]],["Sqrt",[Do]],["Softmax",[Ep,kp]],["Sub",[tu]],["Tan",[Po]],["Tanh",[Uo]],["ThresholdedRelu",[Lo,ha]],["Tile",[Op]],["Transpose",[ua,la]],["Where",[Bp]]])}),Dp,fh=z(()=>{"use strict";Je(),Tt(),Q(),Dp=class{constructor(e){this.backend=e,this.repo=new Map,this.attributesBound=!1}getArtifact(e){return this.repo.get(e)}setArtifact(e,t){this.repo.set(e,t)}run(e,t,r,i,a){tt(e.programInfo.name);let n=this.backend.device,s=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let o=[];for(let l of t)o.push({binding:o.length,resource:{buffer:l.buffer}});for(let l of r)o.push({binding:o.length,resource:{buffer:l.buffer}});a&&o.push({binding:o.length,resource:a});let u=n.createBindGroup({layout:e.computePipeline.getBindGroupLayout(0),entries:o,label:e.programInfo.name});if(this.backend.sessionStatus==="capturing"){let l={kernelId:this.backend.currentKernelId,computePipeline:e.computePipeline,bindGroup:u,dispatchGroup:i};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(l)}s.setPipeline(e.computePipeline),s.setBindGroup(0,u),s.dispatchWorkgroups(...i),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),Ye(e.programInfo.name)}dispose(){}build(e,t){tt(e.name);let r=this.backend.device,i=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"}].forEach(l=>{r.features.has(l.feature)&&i.push(`enable ${l.extension};`)});let a=Ue(t,this.backend.device.limits),n=e.getShaderSource(a),s=`${i.join(`
`)}
${a.additionalImplementations}
${n}`,o=r.createShaderModule({code:s,label:e.name});Se("verbose",()=>`[WebGPU] ${e.name} shader code: ${s}`);let u=r.createComputePipeline({compute:{module:o,entryPoint:"main"},layout:"auto",label:e.name});return Ye(e.name),{programInfo:e,computePipeline:u,uniformVariablesInfo:a.variablesInfo}}normalizeDispatchGroupSize(e){let t=typeof e=="number"?e:e.x,r=typeof e=="number"?1:e.y||1,i=typeof e=="number"?1:e.z||1,a=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(t<=a&&r<=a&&i<=a)return[t,r,i];let n=t*r*i,s=Math.ceil(Math.sqrt(n));if(s>a){if(s=Math.ceil(Math.cbrt(n)),s>a)throw new Error("Total dispatch size exceeds WebGPU maximum.");return[s,s,s]}else return[s,s,1]}}}),Pp={};_e(Pp,{WebGpuBackend:()=>Vp});var Up,Np,Lp,Vp,mh=z(()=>{"use strict";Je(),le(),Tt(),cr(),un(),hh(),fh(),Up=(e,t)=>{if(t.length!==e.length)throw new Error(`inputDependencies length ${t.length} is not equal to inputTensors length ${e.length}.`);let r=[];for(let i=0;i<e.length;++i){let a=e[i].dataType;switch(t[i]){case"none":{r.push("");break}case"type":{r.push(`${a}`);break}case"rank":{let n=e[i].dims.length;r.push(`${a};${n}`);break}case"dims":{let n=e[i].dims.join(",");r.push(`${a};${n}`);break}default:throw new Error(`unsupported input dependency: ${t[i]}`)}}return r.join("|")},Np=(e,t,r)=>{var a,n;let i=e.name;return(a=e.shaderCache)!=null&&a.hint&&(i+="["+e.shaderCache.hint+"]"),i+=":"+r+`:${Up(t,((n=e.shaderCache)==null?void 0:n.inputDependencies)??new Array(t.length).fill("dims"))}`,i},Lp=class{constructor(e){e&&(this.architecture=e.architecture,this.vendor=e.vendor)}isArchitecture(e){return this.architecture===e}isVendor(e){return this.vendor===e}},Vp=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let e=this.kernelCustomData.get(this.currentKernelId);return e||(e={},this.kernelCustomData.set(this.currentKernelId,e)),e}async initialize(e,t){this.env=e;let r=[],i={requiredLimits:{maxComputeWorkgroupStorageSize:t.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:t.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:t.limits.maxStorageBufferBindingSize,maxBufferSize:t.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:t.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:t.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:t.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:t.limits.maxComputeWorkgroupSizeZ},requiredFeatures:r},a=o=>t.features.has(o)&&r.push(o)&&!0;a("chromium-experimental-timestamp-query-inside-passes")||a("timestamp-query"),a("shader-f16"),a("subgroups"),this.device=await t.requestDevice(i);let n=t,s=t.info??(typeof n.requestAdapterInfo=="function"?await n.requestAdapterInfo():void 0);this.adapterInfo=new Lp(s),this.gpuDataManager=za(this),this.programManager=new Dp(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,ci(e.logLevel,!!e.debug),this.device.onuncapturederror=o=>{o.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${o.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!0}),Object.defineProperty(this.env.webgpu,"adapter",{value:t,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){var e;typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose(),this.device&&((e=this.env)!=null&&e.webgpu)&&this.device.lost.then(()=>{delete this.env.webgpu.device})}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let e=this.getCommandEncoder(),t={};this.queryType==="at-passes"&&(t.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=e.beginComputePass(t)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;tt(),this.endComputePass();let e;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),e=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(e,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&e.mapAsync(GPUMapMode.READ).then(()=>{var i;let t=new BigUint64Array(e.getMappedRange()),r=this.pendingQueries.get(e);for(let a=0;a<t.length/2;a++){let n=r[a],s=n.kernelId,o=this.kernels.get(s),u=o.kernelType,l=o.kernelName,p=n.programName,d=n.inputTensorViews,h=n.outputTensorViews,m=t[a*2],f=t[a*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=m);let _=Number(m-this.queryTimeBase),b=Number(f-this.queryTimeBase);if(!Number.isSafeInteger(_)||!Number.isSafeInteger(b))throw new RangeError("incorrect timestamp range");if((i=this.env.webgpu.profiling)!=null&&i.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:d.map(w=>({dims:w.dims,dataType:$t(w.dataType)})),outputsMetadata:h.map(w=>({dims:w.dims,dataType:$t(w.dataType)})),kernelId:s,kernelType:u,kernelName:l,programName:p,startTime:_,endTime:b});else{let w="";d.forEach((x,S)=>{w+=`input[${S}]: [${x.dims}] | ${$t(x.dataType)}, `});let y="";h.forEach((x,S)=>{y+=`output[${S}]: [${x.dims}] | ${$t(x.dataType)}, `}),console.log(`[profiling] kernel "${s}|${u}|${l}|${p}" ${w}${y}start time: ${_} ns, execution time: ${b-_} ns`)}Zt("GPU",`${p}::${m}::${f}`)}e.unmap(),this.pendingQueries.delete(e)}),Ye()}run(e,t,r,i,a,n){tt(e.name);let s=[];for(let y=0;y<t.length;++y){let x=t[y].data;if(x===0)continue;let S=this.gpuDataManager.get(x);if(!S)throw new Error(`no GPU data for input: ${x}`);s.push(S)}let{outputs:o,dispatchGroup:u,programUniforms:l}=e.getRunData(t),p=r.length===0?o.map((y,x)=>x):r;if(p.length!==o.length)throw new Error(`Output size ${p.length} must be equal to ${o.length}.`);let d=[],h=[];for(let y=0;y<o.length;++y){if(!Number.isInteger(p[y])||p[y]<-3||p[y]>=n)throw new Error(`Invalid output index: ${p[y]}`);if(p[y]===-3)continue;let x=p[y]===-1,S=p[y]===-2,E=x||S?a(o[y].dataType,o[y].dims):i(p[y],o[y].dataType,o[y].dims);if(d.push(E),E.data===0)continue;let C=this.gpuDataManager.get(E.data);if(!C)throw new Error(`no GPU data for output: ${E.data}`);if(x&&this.temporaryData.push(C),S){let B=this.kernelPersistentData.get(this.currentKernelId);B||(B=[],this.kernelPersistentData.set(this.currentKernelId,B)),B.push(C)}h.push(C)}if(s.length!==t.length||h.length!==d.length){if(h.length===0)return Ye(e.name),d;throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let m;if(l){let y=0,x=[];l.forEach(B=>{let P=typeof B.data=="number"?[B.data]:B.data;if(P.length===0)return;let L=B.type===10?2:4,W,oe;B.type===10?(oe=P.length>4?16:P.length>2?8:P.length*L,W=P.length>4?16:L*P.length):(oe=P.length<=2?P.length*L:16,W=16),y=Math.ceil(y/oe)*oe,x.push(y);let X=B.type===10?8:4;y+=P.length>4?Math.ceil(P.length/X)*W:P.length*L});let S=16;y=Math.ceil(y/S)*S;let E=new ArrayBuffer(y);l.forEach((B,P)=>{let L=x[P],W=typeof B.data=="number"?[B.data]:B.data;if(B.type===6)new Int32Array(E,L,W.length).set(W);else if(B.type===12)new Uint32Array(E,L,W.length).set(W);else if(B.type===10)new Uint16Array(E,L,W.length).set(W);else if(B.type===1)new Float32Array(E,L,W.length).set(W);else throw new Error(`Unsupported uniform type: ${$t(B.type)}`)});let C=this.gpuDataManager.create(y,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(C.buffer,0,E,0,y),this.gpuDataManager.release(C.id),m={offset:0,size:y,buffer:C.buffer}}let f=this.programManager.normalizeDispatchGroupSize(u),_=f[1]===1&&f[2]===1,b=Np(e,t,_),w=this.programManager.getArtifact(b);if(w||(w=this.programManager.build(e,f),this.programManager.setArtifact(b,w),Se("info",()=>`[artifact] key: ${b}, programName: ${e.name}`)),l&&w.uniformVariablesInfo){if(l.length!==w.uniformVariablesInfo.length)throw new Error(`Uniform variables count mismatch: expect ${w.uniformVariablesInfo.length}, got ${l.length} in program "${w.programInfo.name}".`);for(let y=0;y<l.length;y++){let x=l[y],S=x.type,E=typeof x.data=="number"?1:x.data.length,[C,B]=w.uniformVariablesInfo[y];if(S!==C||E!==B)throw new Error(`Uniform variable ${y} mismatch: expect type ${C} with size ${B}, got type ${S} with size ${E} in program "${w.programInfo.name}".`)}}if(Se("info",()=>`[ProgramManager] run "${e.name}" (key=${b}) with ${f[0]}x${f[1]}x${f[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let y={kernelId:this.currentKernelId,programName:w.programInfo.name,inputTensorViews:t,outputTensorViews:d};this.pendingKernels.push(y),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(y)}return this.programManager.run(w,s,h,f,m),Ye(e.name),d}upload(e,t){this.gpuDataManager.upload(e,t)}memcpy(e,t){this.gpuDataManager.memcpy(e,t)}async download(e,t){await this.gpuDataManager.download(e,t)}alloc(e){return this.gpuDataManager.create(e).id}free(e){return this.gpuDataManager.release(e)}createKernel(e,t,r,i){let a=Mp.get(e);if(!a)throw new Error(`kernel not implemented: ${e}`);let n={kernelType:e,kernelName:i,kernelEntry:a[0],attributes:[a[1],r]};this.kernels.set(t,n)}releaseKernel(e){let t=this.kernelPersistentData.get(e);if(t){for(let r of t)this.gpuDataManager.release(r.id);this.kernelPersistentData.delete(e)}this.kernelCustomData.delete(e),this.kernels.delete(e)}computeKernel(e,t,r){let i=this.kernels.get(e);if(!i)throw new Error(`kernel not created: ${e}`);let a=i.kernelType,n=i.kernelName,s=i.kernelEntry,o=i.attributes;if(this.currentKernelId!==null)throw new Error(`kernel "[${a}] ${n}" is not allowed to be called recursively`);this.currentKernelId=e,o[0]&&(o[1]=o[0](o[1]),o[0]=void 0),Se("info",()=>`[WebGPU] Start to run kernel "[${a}] ${n}"...`);let u=this.env.debug;this.temporaryData=[];try{return u&&this.device.pushErrorScope("validation"),s(t,o[1]),0}catch(l){return r.push(Promise.resolve(`[WebGPU] Kernel "[${a}] ${n}" failed. ${l}`)),1}finally{u&&r.push(this.device.popErrorScope().then(l=>l?`GPU validation error for kernel "[${a}] ${n}": ${l.message}`:null));for(let l of this.temporaryData)this.gpuDataManager.release(l.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(e,t,r,i){let a=this.sessionExternalDataMapping.get(e);a||(a=new Map,this.sessionExternalDataMapping.set(e,a));let n=a.get(t),s=this.gpuDataManager.registerExternalBuffer(r,i,n);return a.set(t,[s,r]),s}unregisterBuffers(e){let t=this.sessionExternalDataMapping.get(e);t&&(t.forEach(r=>this.gpuDataManager.unregisterExternalBuffer(r[0])),this.sessionExternalDataMapping.delete(e))}getBuffer(e){let t=this.gpuDataManager.get(e);if(!t)throw new Error(`no GPU data for buffer: ${e}`);return t.buffer}createDownloader(e,t,r){return async()=>{let i=await sa(this,e,t);return Yt(i.buffer,r)}}writeTimestamp(e){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,e)}setQueryType(){var e;this.queryType="none",(((e=this.env.webgpu.profiling)==null?void 0:e.mode)==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){Se("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){Se("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){Se("info","replay"),this.sessionStatus="replaying";let e=this.capturedCommandList.get(this.currentSessionId),t=this.capturedPendingKernels.get(this.currentSessionId),r=e.length;this.pendingKernels=[];for(let i=0;i<r;i++){let a=this.getComputePassEncoder(),n=e[i];this.writeTimestamp(this.pendingDispatchNumber*2),a.setPipeline(n.computePipeline),a.setBindGroup(0,n.bindGroup),a.dispatchWorkgroups(...n.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(t[i]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(e){this.unregisterBuffers(e),this.capturedCommandList.has(e)&&this.capturedCommandList.delete(e),this.capturedPendingKernels.has(e)&&this.capturedPendingKernels.delete(e),this.gpuDataManager.onReleaseSession(e)}onRunStart(e){this.currentSessionId=e,this.setQueryType()}}}),Fp={};_e(Fp,{init:()=>Gp});var Fa,qp,Gp,gh=z(()=>{"use strict";le(),Tt(),re(),na(),Fa=class _c{constructor(t,r,i,a){this.module=t,this.dataType=r,this.data=i,this.dims=a}getFloat32Array(){if(this.dataType!==1)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,t)}getBigInt64Array(){if(this.dataType!==7)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,t)}getInt32Array(){if(this.dataType!==6)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,t)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw new Error("Invalid data type");let t=M.size(this.dims);return t===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,t)}reshape(t){if(M.size(t)!==M.size(this.dims))throw new Error("Invalid new shape");return new _c(this.module,this.dataType,this.data,t)}},qp=class{constructor(e,t,r){this.module=e,this.backend=t,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=t.adapterInfo;let i=e.PTR_SIZE,a=r/e.PTR_SIZE,n=i===4?"i32":"i64";this.opKernelContext=Number(e.getValue(i*a++,n));let s=Number(e.getValue(i*a++,n));this.outputCount=Number(e.getValue(i*a++,n)),this.customDataOffset=Number(e.getValue(i*a++,"*")),this.customDataSize=Number(e.getValue(i*a++,n));let o=[];for(let u=0;u<s;u++){let l=Number(e.getValue(i*a++,n)),p=Number(e.getValue(i*a++,"*")),d=Number(e.getValue(i*a++,n)),h=[];for(let m=0;m<d;m++)h.push(Number(e.getValue(i*a++,n)));o.push(new Fa(e,l,p,h))}this.inputs=o}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(e,t){var s;let r=((s=t==null?void 0:t.inputs)==null?void 0:s.map(o=>typeof o=="number"?this.inputs[o]:o))??this.inputs,i=(t==null?void 0:t.outputs)??[],a=(o,u,l)=>new Fa(this.module,u,this.output(o,l),l),n=(o,u)=>{let l=bt(o,u);if(!l)throw new Error(`Unsupported data type: ${o}`);let p=l>0?this.backend.gpuDataManager.create(l).id:0;return new Fa(this.module,o,p,u)};return this.backend.run(e,r,i,a,n,this.outputCount)}output(e,t){let r=this.module.stackSave();try{let i=this.module.PTR_SIZE,a=i===4?"i32":"i64",n=this.module.stackAlloc((1+t.length)*i);this.module.setValue(n,t.length,a);for(let s=0;s<t.length;s++)this.module.setValue(n+i*(s+1),t[s],a);return this.module._JsepOutput(this.opKernelContext,e,n)}catch(i){throw new Error(`Failed to generate kernel's output[${e}] with dims [${t}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${i}`)}finally{this.module.stackRestore(r)}}},Gp=async(e,t,r,i)=>{let a=t.jsepInit;if(!a)throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(e==="webgpu"){let n=(mh(),je(Pp)).WebGpuBackend,s=new n;await s.initialize(r,i),a("webgpu",[s,o=>s.alloc(Number(o)),o=>s.free(o),(o,u,l,p=!1)=>{if(p)Se("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(o)}, dst=${Number(u)}, size=${Number(l)}`),s.memcpy(Number(o),Number(u));else{Se("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(o)}, gpuDataId=${Number(u)}, size=${Number(l)}`);let d=t.HEAPU8.subarray(Number(o>>>0),Number(o>>>0)+Number(l));s.upload(Number(u),d)}},async(o,u,l)=>{Se("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${o}, dataOffset=${u}, size=${l}`),await s.download(Number(o),()=>t.HEAPU8.subarray(Number(u)>>>0,Number(u+l)>>>0))},(o,u,l)=>s.createKernel(o,Number(u),l,t.UTF8ToString(t._JsepGetNodeName(Number(u)))),o=>s.releaseKernel(o),(o,u,l,p)=>{Se("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${l}, kernel=${o}, contextDataOffset=${u}`);let d=new qp(t,s,Number(u));return s.computeKernel(Number(o),d,p)},()=>s.captureBegin(),()=>s.captureEnd(),()=>s.replay()])}else{let n=new aa(r);a("webnn",[n,()=>n.reserveTensorId(),s=>n.releaseTensorId(s),async(s,o,u,l,p)=>n.ensureTensor(s,o,u,l,p),(s,o)=>{n.uploadTensor(s,o)},async(s,o)=>n.downloadTensor(s,o),(s,o)=>n.registerMLContext(s,o),!!r.trace])}}}),Wp,as,ns,gr,jp,ss,qa,os,us,ls,ds,ps,cs,Hp=z(()=>{"use strict";Je(),sn(),on(),le(),_t(),Lr(),Yi(),Wp=(e,t)=>{pe()._OrtInit(e,t)!==0&&ne("Can't initialize onnxruntime.")},as=async e=>{Wp(e.wasm.numThreads,Fr(e.logLevel))},ns=async(e,t)=>{var i,a;(a=(i=pe()).asyncInit)==null||a.call(i);let r=e.webgpu.adapter;if(t==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if(r){if(typeof r.limits!="object"||typeof r.features!="object"||typeof r.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let n=e.webgpu.powerPreference;if(n!==void 0&&n!=="low-power"&&n!=="high-performance")throw new Error(`Invalid powerPreference setting: "${n}"`);let s=e.webgpu.forceFallbackAdapter;if(s!==void 0&&typeof s!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${s}"`);if(r=await navigator.gpu.requestAdapter({powerPreference:n,forceFallbackAdapter:s}),!r)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(t==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment");{let n=(gh(),je(Fp)).init;t==="webgpu"&&await n("webgpu",pe(),e,r),t==="webnn"&&await n("webnn",pe(),e)}},gr=new Map,jp=e=>{let t=pe(),r=t.stackSave();try{let i=t.PTR_SIZE,a=t.stackAlloc(2*i);t._OrtGetInputOutputCount(e,a,a+i)!==0&&ne("Can't get session input/output count.");let n=i===4?"i32":"i64";return[Number(t.getValue(a,n)),Number(t.getValue(a+i,n))]}finally{t.stackRestore(r)}},ss=(e,t)=>{let r=pe(),i=r.stackSave(),a=0;try{let n=r.PTR_SIZE,s=r.stackAlloc(2*n);r._OrtGetInputOutputMetadata(e,t,s,s+n)!==0&&ne("Can't get session input/output metadata.");let o=Number(r.getValue(s,"*"));a=Number(r.getValue(s+n,"*"));let u=r.HEAP32[a/4];if(u===0)return[o,0];let l=r.HEAPU32[a/4+1],p=[];for(let d=0;d<l;d++){let h=Number(r.getValue(a+8+d*n,"*"));p.push(h!==0?r.UTF8ToString(h):Number(r.getValue(a+8+(d+l)*n,"*")))}return[o,u,p]}finally{r.stackRestore(i),a!==0&&r._OrtFree(a)}},qa=e=>{let t=pe(),r=t._malloc(e.byteLength);if(r===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);return t.HEAPU8.set(e,r),[r,e.byteLength]},os=async(e,t)=>{var d,h,m,f;let r,i,a=pe();Array.isArray(e)?[r,i]=e:e.buffer===a.HEAPU8.buffer?[r,i]=[e.byteOffset,e.byteLength]:[r,i]=qa(e);let n=0,s=0,o=0,u=[],l=[],p=[];try{if([s,u]=await Xi(t),(t==null?void 0:t.externalData)&&a.mountExternalData){let P=[];for(let L of t.externalData){let W=typeof L=="string"?L:L.path,oe=typeof L=="string"?L:L.data;P.push(Wr(oe).then(X=>{a.mountExternalData(W,X)}))}await Promise.all(P)}for(let P of(t==null?void 0:t.executionProviders)??[])if((typeof P=="string"?P:P.name)==="webnn"){if(a.shouldTransferToMLTensor=!1,typeof P!="string"){let L=P,W=L==null?void 0:L.context,oe=L==null?void 0:L.gpuDevice,X=L==null?void 0:L.deviceType,ee=L==null?void 0:L.powerPreference;W?a.currentContext=W:oe?a.currentContext=await a.webnnCreateMLContext(oe):a.currentContext=await a.webnnCreateMLContext({deviceType:X,powerPreference:ee})}else a.currentContext=await a.webnnCreateMLContext();break}n=await a._OrtCreateSession(r,i,s),(d=a.webgpuOnCreateSession)==null||d.call(a,n),n===0&&ne("Can't create a session."),(h=a.jsepOnCreateSession)==null||h.call(a),a.currentContext&&(a.webnnRegisterMLContext(n,a.currentContext),a.currentContext=void 0,a.shouldTransferToMLTensor=!0);let[_,b]=jp(n),w=!!(t!=null&&t.enableGraphCapture),y=[],x=[],S=[],E=[],C=[];for(let P=0;P<_;P++){let[L,W,oe]=ss(n,P);L===0&&ne("Can't get an input name."),l.push(L);let X=a.UTF8ToString(L);y.push(X),S.push(W===0?{name:X,isTensor:!1}:{name:X,isTensor:!0,type:$t(W),shape:oe})}for(let P=0;P<b;P++){let[L,W,oe]=ss(n,P+_);L===0&&ne("Can't get an output name."),p.push(L);let X=a.UTF8ToString(L);x.push(X),E.push(W===0?{name:X,isTensor:!1}:{name:X,isTensor:!0,type:$t(W),shape:oe});{if(w&&(t==null?void 0:t.preferredOutputLocation)===void 0){C.push("gpu-buffer");continue}let ee=typeof(t==null?void 0:t.preferredOutputLocation)=="string"?t.preferredOutputLocation:((m=t==null?void 0:t.preferredOutputLocation)==null?void 0:m[X])??"cpu",Ee=a.webnnIsGraphOutput;if(ee==="cpu"&&Ee&&Ee(n,X)){C.push("ml-tensor-cpu-output");continue}if(ee!=="cpu"&&ee!=="cpu-pinned"&&ee!=="gpu-buffer"&&ee!=="ml-tensor")throw new Error(`Not supported preferred output location: ${ee}.`);if(w&&ee!=="gpu-buffer")throw new Error(`Not supported preferred output location: ${ee}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);C.push(ee)}}let B=null;return C.some(P=>P==="gpu-buffer"||P==="ml-tensor"||P==="ml-tensor-cpu-output")&&(o=a._OrtCreateBinding(n),o===0&&ne("Can't create IO binding."),B={handle:o,outputPreferredLocations:C,outputPreferredLocationsEncoded:C.map(P=>P==="ml-tensor-cpu-output"?"ml-tensor":P).map(P=>li(P))}),gr.set(n,[n,l,p,B,w,!1]),[n,y,x,S,E]}catch(_){throw l.forEach(b=>a._OrtFree(b)),p.forEach(b=>a._OrtFree(b)),o!==0&&a._OrtReleaseBinding(o)!==0&&ne("Can't release IO binding."),n!==0&&a._OrtReleaseSession(n)!==0&&ne("Can't release session."),_}finally{a._free(r),s!==0&&a._OrtReleaseSessionOptions(s)!==0&&ne("Can't release session options."),u.forEach(_=>a._free(_)),(f=a.unmountExternalData)==null||f.call(a)}},us=e=>{var u,l,p;let t=pe(),r=gr.get(e);if(!r)throw new Error(`cannot release session. invalid session id: ${e}`);let[i,a,n,s,o]=r;s&&(o&&t._OrtClearBoundOutputs(s.handle)!==0&&ne("Can't clear bound outputs."),t._OrtReleaseBinding(s.handle)!==0&&ne("Can't release IO binding.")),(u=t.jsepOnReleaseSession)==null||u.call(t,e),(l=t.webnnOnReleaseSession)==null||l.call(t,e),(p=t.webgpuOnReleaseSession)==null||p.call(t,e),a.forEach(d=>t._OrtFree(d)),n.forEach(d=>t._OrtFree(d)),t._OrtReleaseSession(i)!==0&&ne("Can't release session."),gr.delete(e)},ls=async(e,t,r,i,a,n,s=!1)=>{if(!e){t.push(0);return}let o=pe(),u=o.PTR_SIZE,l=e[0],p=e[1],d=e[3],h=d,m,f;if(l==="string"&&(d==="gpu-buffer"||d==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(s&&d!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${n} when enableGraphCapture is true.`);if(d==="gpu-buffer"){let w=e[2].gpuBuffer;f=bt(wt(l),p);{let y=o.jsepRegisterBuffer;if(!y)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');m=y(i,n,w,f)}}else if(d==="ml-tensor"){let w=e[2].mlTensor;f=bt(wt(l),p);let y=o.webnnRegisterMLTensor;if(!y)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');m=y(i,w,wt(l),p)}else{let w=e[2];if(Array.isArray(w)){f=u*w.length,m=o._malloc(f),r.push(m);for(let y=0;y<w.length;y++){if(typeof w[y]!="string")throw new TypeError(`tensor data at index ${y} is not a string`);o.setValue(m+y*u,Ge(w[y],r),"*")}}else{let y=o.webnnIsGraphInput,x=o.webnnIsGraphOutput;if(l!=="string"&&y&&x){let S=o.UTF8ToString(a);if(y(i,S)||x(i,S)){let E=wt(l);f=bt(E,p),h="ml-tensor";let C=o.webnnCreateTemporaryTensor,B=o.webnnUploadTensor;if(!C||!B)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let P=await C(i,E,p);B(P,new Uint8Array(w.buffer,w.byteOffset,w.byteLength)),m=P}else f=w.byteLength,m=o._malloc(f),r.push(m),o.HEAPU8.set(new Uint8Array(w.buffer,w.byteOffset,f),m)}else f=w.byteLength,m=o._malloc(f),r.push(m),o.HEAPU8.set(new Uint8Array(w.buffer,w.byteOffset,f),m)}}let _=o.stackSave(),b=o.stackAlloc(4*p.length);try{p.forEach((y,x)=>o.setValue(b+x*u,y,u===4?"i32":"i64"));let w=o._OrtCreateTensor(wt(l),m,f,b,p.length,li(h));w===0&&ne(`Can't create tensor for input/output. session=${i}, index=${n}.`),t.push(w)}finally{o.stackRestore(_)}},ds=async(e,t,r,i,a,n)=>{var X,ee,Ee,ke;let s=pe(),o=s.PTR_SIZE,u=gr.get(e);if(!u)throw new Error(`cannot run inference. invalid session id: ${e}`);let l=u[0],p=u[1],d=u[2],h=u[3],m=u[4],f=u[5],_=t.length,b=i.length,w=0,y=[],x=[],S=[],E=[],C=[],B=s.stackSave(),P=s.stackAlloc(_*o),L=s.stackAlloc(_*o),W=s.stackAlloc(b*o),oe=s.stackAlloc(b*o);try{[w,y]=ji(n),lt("wasm prepareInputOutputTensor");for(let j=0;j<_;j++)await ls(r[j],x,E,e,p[t[j]],t[j],m);for(let j=0;j<b;j++)await ls(a[j],S,E,e,d[i[j]],_+i[j],m);dt("wasm prepareInputOutputTensor");for(let j=0;j<_;j++)s.setValue(P+j*o,x[j],"*"),s.setValue(L+j*o,p[t[j]],"*");for(let j=0;j<b;j++)s.setValue(W+j*o,S[j],"*"),s.setValue(oe+j*o,d[i[j]],"*");if(h&&!f){let{handle:j,outputPreferredLocations:Ce,outputPreferredLocationsEncoded:G}=h;if(p.length!==_)throw new Error(`input count from feeds (${_}) is expected to be always equal to model's input count (${p.length}).`);lt("wasm bindInputsOutputs");for(let K=0;K<_;K++){let J=t[K];await s._OrtBindInput(j,p[J],x[K])!==0&&ne(`Can't bind input[${K}] for session=${e}.`)}for(let K=0;K<b;K++){let J=i[K];(X=a[K])!=null&&X[3]?(C.push(S[K]),s._OrtBindOutput(j,d[J],S[K],0)!==0&&ne(`Can't bind pre-allocated output[${K}] for session=${e}.`)):s._OrtBindOutput(j,d[J],0,G[J])!==0&&ne(`Can't bind output[${K}] to ${Ce[K]} for session=${e}.`)}dt("wasm bindInputsOutputs"),gr.set(e,[l,p,d,h,m,!0])}(ee=s.jsepOnRunStart)==null||ee.call(s,l),(Ee=s.webnnOnRunStart)==null||Ee.call(s,l);let ae;h?ae=await s._OrtRunWithBinding(l,h.handle,b,W,w):ae=await s._OrtRun(l,L,P,_,oe,b,W,w),ae!==0&&ne("failed to call OrtRun().");let ce=[],Qe=[];lt("wasm ProcessOutputTensor");for(let j=0;j<b;j++){let Ce=Number(s.getValue(W+j*o,"*"));if(Ce===S[j]||C.includes(S[j])){ce.push(a[j]),Ce!==S[j]&&s._OrtReleaseTensor(Ce)!==0&&ne("Can't release tensor.");continue}let G=s.stackSave(),K=s.stackAlloc(4*o),J=!1,H,Re=0;try{s._OrtGetTensorData(Ce,K,K+o,K+2*o,K+3*o)!==0&&ne(`Can't access output tensor data on index ${j}.`);let lr=o===4?"i32":"i64",ot=Number(s.getValue(K,lr));Re=s.getValue(K+o,"*");let Ht=s.getValue(K+o*2,"*"),Kt=Number(s.getValue(K+o*3,lr)),_r=[];for(let st=0;st<Kt;st++)_r.push(Number(s.getValue(Ht+st*o,lr)));s._OrtFree(Ht)!==0&&ne("Can't free memory for tensor dims.");let wr=_r.reduce((st,Xe)=>st*Xe,1);H=$t(ot);let xa=h==null?void 0:h.outputPreferredLocations[i[j]];if(H==="string"){if(xa==="gpu-buffer"||xa==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let st=[];for(let Xe=0;Xe<wr;Xe++){let dr=s.getValue(Re+Xe*o,"*"),bh=s.getValue(Re+(Xe+1)*o,"*"),vh=Xe===wr-1?void 0:bh-dr;st.push(s.UTF8ToString(dr,vh))}ce.push([H,_r,st,"cpu"])}else if(xa==="gpu-buffer"&&wr>0){let st=s.jsepGetBuffer;if(!st)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let Xe=st(Re),dr=bt(ot,wr);if(dr===void 0||!qr(H))throw new Error(`Unsupported data type: ${H}`);J=!0,ce.push([H,_r,{gpuBuffer:Xe,download:s.jsepCreateDownloader(Xe,dr,H),dispose:()=>{s._OrtReleaseTensor(Ce)!==0&&ne("Can't release tensor.")}},"gpu-buffer"])}else if(xa==="ml-tensor"&&wr>0){let st=s.webnnEnsureTensor,Xe=s.webnnIsGraphInputOutputTypeSupported;if(!st||!Xe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(bt(ot,wr)===void 0||!Gr(H))throw new Error(`Unsupported data type: ${H}`);if(!Xe(e,H,!1))throw new Error(`preferredLocation "ml-tensor" for ${H} output is not supported by current WebNN Context.`);let dr=await st(e,Re,ot,_r,!1);J=!0,ce.push([H,_r,{mlTensor:dr,download:s.webnnCreateMLTensorDownloader(Re,H),dispose:()=>{s.webnnReleaseTensorId(Re),s._OrtReleaseTensor(Ce)}},"ml-tensor"])}else if(xa==="ml-tensor-cpu-output"&&wr>0){let st=s.webnnCreateMLTensorDownloader(Re,H)(),Xe=ce.length;J=!0,Qe.push((async()=>{let dr=[Xe,await st];return s.webnnReleaseTensorId(Re),s._OrtReleaseTensor(Ce),dr})()),ce.push([H,_r,[],"cpu"])}else{let st=Vr(H),Xe=new st(wr);new Uint8Array(Xe.buffer,Xe.byteOffset,Xe.byteLength).set(s.HEAPU8.subarray(Re,Re+Xe.byteLength)),ce.push([H,_r,Xe,"cpu"])}}finally{s.stackRestore(G),H==="string"&&Re&&s._free(Re),J||s._OrtReleaseTensor(Ce)}}h&&!m&&(s._OrtClearBoundOutputs(h.handle)!==0&&ne("Can't clear bound outputs."),gr.set(e,[l,p,d,h,m,!1]));for(let[j,Ce]of await Promise.all(Qe))ce[j][2]=Ce;return dt("wasm ProcessOutputTensor"),ce}finally{(ke=s.webnnOnRunEnd)==null||ke.call(s,l),s.stackRestore(B),x.forEach(ae=>s._OrtReleaseTensor(ae)),S.forEach(ae=>s._OrtReleaseTensor(ae)),E.forEach(ae=>s._free(ae)),w!==0&&s._OrtReleaseRunOptions(w),y.forEach(ae=>s._free(ae))}},ps=e=>{let t=pe(),r=gr.get(e);if(!r)throw new Error("invalid session id");let i=r[0],a=t._OrtEndProfiling(i);a===0&&ne("Can't get an profile file name."),t._OrtFree(a)},cs=e=>{let t=[];for(let r of e){let i=r[2];!Array.isArray(i)&&"buffer"in i&&t.push(i.buffer)}return t}}),yr,xt,Ti,ba,va,Ga,hs,Wa,ai,ni,Kp,Zp,Qp,Xp,Yp,Jp,ec,tc,rc=z(()=>{"use strict";Je(),Hp(),_t(),Dr(),yr=()=>!!te.wasm.proxy&&typeof document<"u",Ti=!1,ba=!1,va=!1,Wa=new Map,ai=(e,t)=>{let r=Wa.get(e);r?r.push(t):Wa.set(e,[t])},ni=()=>{if(Ti||!ba||va||!xt)throw new Error("worker not ready")},Kp=e=>{switch(e.data.type){case"init-wasm":Ti=!1,e.data.err?(va=!0,hs[1](e.data.err)):(ba=!0,hs[0]()),Ga&&(URL.revokeObjectURL(Ga),Ga=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let t=Wa.get(e.data.type);e.data.err?t.shift()[1](e.data.err):t.shift()[0](e.data.out);break}default:}},Zp=async()=>{if(!ba){if(Ti)throw new Error("multiple calls to 'initWasm()' detected.");if(va)throw new Error("previous call to 'initWasm()' failed.");if(Ti=!0,yr())return new Promise((e,t)=>{xt==null||xt.terminate(),Vi().then(([r,i])=>{try{xt=i,xt.onerror=n=>t(n),xt.onmessage=Kp,hs=[e,t];let a={type:"init-wasm",in:te};if(!a.in.wasm.wasmPaths&&r){let n=Ar();n&&(a.in.wasm.wasmPaths=n)}xt.postMessage(a),Ga=r}catch(a){t(a)}},t)});try{await Nr(te.wasm),await as(te),ba=!0}catch(e){throw va=!0,e}finally{Ti=!1}}},Qp=async e=>{if(yr())return ni(),new Promise((t,r)=>{ai("init-ep",[t,r]);let i={type:"init-ep",in:{epName:e,env:te}};xt.postMessage(i)});await ns(te,e)},Xp=async e=>yr()?(ni(),new Promise((t,r)=>{ai("copy-from",[t,r]);let i={type:"copy-from",in:{buffer:e}};xt.postMessage(i,[e.buffer])})):qa(e),Yp=async(e,t)=>{if(yr()){if(t!=null&&t.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return ni(),new Promise((r,i)=>{ai("create",[r,i]);let a={type:"create",in:{model:e,options:{...t}}},n=[];e instanceof Uint8Array&&n.push(e.buffer),xt.postMessage(a,n)})}else return os(e,t)},Jp=async e=>{if(yr())return ni(),new Promise((t,r)=>{ai("release",[t,r]);let i={type:"release",in:e};xt.postMessage(i)});us(e)},ec=async(e,t,r,i,a,n)=>{if(yr()){if(r.some(s=>s[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(a.some(s=>s))throw new Error("pre-allocated output tensor is not supported for proxy.");return ni(),new Promise((s,o)=>{ai("run",[s,o]);let u=r,l={type:"run",in:{sessionId:e,inputIndices:t,inputs:u,outputIndices:i,options:n}};xt.postMessage(l,cs(u))})}else return ds(e,t,r,i,a,n)},tc=async e=>{if(yr())return ni(),new Promise((t,r)=>{ai("end-profiling",[t,r]);let i={type:"end-profiling",in:e};xt.postMessage(i)});ps(e)}}),fs,ic,ac,yh=z(()=>{"use strict";Je(),rc(),le(),zr(),Yi(),fs=(e,t)=>{switch(e.location){case"cpu":return[e.type,e.dims,e.data,"cpu"];case"gpu-buffer":return[e.type,e.dims,{gpuBuffer:e.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[e.type,e.dims,{mlTensor:e.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${e.location} for ${t()}`)}},ic=e=>{switch(e[3]){case"cpu":return new qe(e[0],e[2],e[1]);case"gpu-buffer":{let t=e[0];if(!qr(t))throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);let{gpuBuffer:r,download:i,dispose:a}=e[2];return qe.fromGpuBuffer(r,{dataType:t,dims:e[1],download:i,dispose:a})}case"ml-tensor":{let t=e[0];if(!Gr(t))throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);let{mlTensor:r,download:i,dispose:a}=e[2];return qe.fromMLTensor(r,{dataType:t,dims:e[1],download:i,dispose:a})}default:throw new Error(`invalid data location: ${e[3]}`)}},ac=class{async fetchModelAndCopyToWasmMemory(e){return Xp(await Wr(e))}async loadModel(e,t){tt();let r;typeof e=="string"?r=await this.fetchModelAndCopyToWasmMemory(e):r=e,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await Yp(r,t),Ye()}async dispose(){return Jp(this.sessionId)}async run(e,t,r){tt();let i=[],a=[];Object.entries(e).forEach(d=>{let h=d[0],m=d[1],f=this.inputNames.indexOf(h);if(f===-1)throw new Error(`invalid input '${h}'`);i.push(m),a.push(f)});let n=[],s=[];Object.entries(t).forEach(d=>{let h=d[0],m=d[1],f=this.outputNames.indexOf(h);if(f===-1)throw new Error(`invalid output '${h}'`);n.push(m),s.push(f)});let o=i.map((d,h)=>fs(d,()=>`input "${this.inputNames[a[h]]}"`)),u=n.map((d,h)=>d?fs(d,()=>`output "${this.outputNames[s[h]]}"`):null),l=await ec(this.sessionId,a,o,s,u,r),p={};for(let d=0;d<l.length;d++)p[this.outputNames[s[d]]]=n[d]??ic(l[d]);return Ye(),p}startProfiling(){}endProfiling(){tc(this.sessionId)}}}),nc={};_e(nc,{OnnxruntimeWebAssemblyBackend:()=>gs,initializeFlags:()=>ms,wasmBackend:()=>sc});var ms,gs,sc,_h=z(()=>{"use strict";Je(),rc(),yh(),ms=()=>{(typeof te.wasm.initTimeout!="number"||te.wasm.initTimeout<0)&&(te.wasm.initTimeout=0);let e=te.wasm.simd;if(typeof e!="boolean"&&e!==void 0&&e!=="fixed"&&e!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`),te.wasm.simd=!1),typeof te.wasm.proxy!="boolean"&&(te.wasm.proxy=!1),typeof te.wasm.trace!="boolean"&&(te.wasm.trace=!1),typeof te.wasm.numThreads!="number"||!Number.isInteger(te.wasm.numThreads)||te.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)te.wasm.numThreads=1;else{let t=typeof navigator>"u"?ge("node:os").cpus().length:navigator.hardwareConcurrency;te.wasm.numThreads=Math.min(4,Math.ceil((t||1)/2))}},gs=class{async init(e){ms(),await Zp(),await Qp(e)}async createInferenceSessionHandler(e,t){let r=new ac;return await r.loadModel(e,t),r}},sc=new gs}),oc={};_e(oc,{InferenceSession:()=>Ir,TRACE:()=>Zt,TRACE_EVENT_BEGIN:()=>lt,TRACE_EVENT_END:()=>dt,TRACE_FUNC_BEGIN:()=>tt,TRACE_FUNC_END:()=>Ye,Tensor:()=>qe,default:()=>$h,env:()=>te,registerBackend:()=>we}),Je(),Je(),Je();var wh="1.30.0",$h=Ri;{let e=(_h(),je(nc)).wasmBackend;we("webgpu",e,5),we("webnn",e,5),we("cpu",e,10),we("wasm",e,10)}return Object.defineProperty(te.versions,"web",{value:wh,enumerable:!0}),je(oc)})();/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 *//**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 *//**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */V.exports=se})(gc);var zh=gc.exports,ws={},wc={};Object.defineProperty(wc,"__esModule",{value:!0});var Ka={},$c;Object.defineProperty(Ka,"__esModule",{value:!0});Ka.SileroLegacy=void 0;const cc=br;class $s{constructor(ie,se,Z,ue,he){this.ortInstance=ie,this._session=se,this._h=Z,this._c=ue,this._sr=he,this.reset_state=()=>{const fe=Array(128).fill(0);this._h=new this.ortInstance.Tensor("float32",fe,[2,1,64]),this._c=new this.ortInstance.Tensor("float32",fe,[2,1,64])},this.process=async fe=>{var $e;const z={input:new this.ortInstance.Tensor("float32",fe,[1,fe.length]),h:this._h,c:this._c,sr:this._sr},_e=await this._session.run(z);this._h=_e.hn,this._c=_e.cn;const[We]=($e=_e.output)==null?void 0:$e.data;return{notSpeech:1-We,isSpeech:We}},this.release=async()=>{await this._session.release(),this._h.dispose(),this._c.dispose(),this._sr.dispose()}}}Ka.SileroLegacy=$s;$c=$s;$s.new=async(V,ie)=>{cc.log.debug("initializing vad");const se=await ie(),Z=await V.InferenceSession.create(se),ue=new V.Tensor("int64",[16000n]),he=Array(2*64).fill(0),fe=new V.Tensor("float32",he,[2,1,64]),ge=new V.Tensor("float32",he,[2,1,64]);return cc.log.debug("vad is initialized"),new $c(V,Z,fe,ge,ue)};var Za={},bc;Object.defineProperty(Za,"__esModule",{value:!0});Za.Silero=void 0;const hc=br,Ta=64;function vc(V){const ie=Array(256).fill(0);return new V.Tensor("float32",ie,[2,1,128])}class bs{constructor(ie,se,Z,ue){this._session=ie,this._state=se,this._sr=Z,this.ortInstance=ue,this._context=new Float32Array(Ta),this.reset_state=()=>{this._state=vc(this.ortInstance),this._context=new Float32Array(Ta)},this.process=async he=>{var $e;const fe=new Float32Array(Ta+he.length);fe.set(this._context,0),fe.set(he,Ta),this._context=he.slice(-Ta);const z={input:new this.ortInstance.Tensor("float32",fe,[1,fe.length]),state:this._state,sr:this._sr},_e=await this._session.run(z);if(!_e.stateN)throw new Error("No state from model");if(this._state=_e.stateN,!(($e=_e.output)!=null&&$e.data))throw new Error("No output from model");const We=_e.output.data[0];if(typeof We!="number")throw new Error("Weird output data");return{notSpeech:1-We,isSpeech:We}},this.release=async()=>{await this._session.release(),this._state.dispose(),this._sr.dispose()}}}Za.Silero=bs;bc=bs;bs.new=async(V,ie)=>{hc.log.debug("Loading VAD...");const se=await ie(),Z=await V.InferenceSession.create(se),ue=new V.Tensor("int64",[16000n]),he=vc(V);return hc.log.debug("...finished loading VAD"),new bc(Z,he,ue,V)};(function(V){var ie=ct&&ct.__createBinding||(Object.create?function(he,fe,ge,z){z===void 0&&(z=ge);var _e=Object.getOwnPropertyDescriptor(fe,ge);(!_e||("get"in _e?!fe.__esModule:_e.writable||_e.configurable))&&(_e={enumerable:!0,get:function(){return fe[ge]}}),Object.defineProperty(he,z,_e)}:function(he,fe,ge,z){z===void 0&&(z=ge),he[z]=fe[ge]}),se=ct&&ct.__exportStar||function(he,fe){for(var ge in he)ge!=="default"&&!Object.prototype.hasOwnProperty.call(fe,ge)&&ie(fe,he,ge)};Object.defineProperty(V,"__esModule",{value:!0}),V.Silero=V.SileroLegacy=void 0,se(wc,V);var Z=Ka;Object.defineProperty(V,"SileroLegacy",{enumerable:!0,get:function(){return Z.SileroLegacy}});var ue=Za;Object.defineProperty(V,"Silero",{enumerable:!0,get:function(){return ue.Silero}})})(ws);var ka={};Object.defineProperty(ka,"__esModule",{value:!0});ka.Resampler=void 0;const Ch=br;class Oh{constructor(ie){this.options=ie,this.process=se=>{const Z=[];for(const ue of se)for(this.inputBuffer.push(ue);this.hasEnoughDataForFrame();){const he=this.generateOutputFrame();Z.push(he)}return Z},ie.nativeSampleRate<16e3&&Ch.log.error("nativeSampleRate is too low. Should have 16000 = targetSampleRate <= nativeSampleRate"),this.inputBuffer=[]}async*stream(ie){for(const se of ie)for(this.inputBuffer.push(se);this.hasEnoughDataForFrame();)yield this.generateOutputFrame()}hasEnoughDataForFrame(){return this.inputBuffer.length*this.options.targetSampleRate/this.options.nativeSampleRate>=this.options.targetFrameSize}generateOutputFrame(){const ie=new Float32Array(this.options.targetFrameSize);let se=0,Z=0;for(;se<this.options.targetFrameSize;){let ue=0,he=0;for(;Z<Math.min(this.inputBuffer.length,(se+1)*this.options.nativeSampleRate/this.options.targetSampleRate);){const fe=this.inputBuffer[Z];fe!==void 0&&(ue+=fe,he++),Z++}ie[se]=ue/he,se++}return this.inputBuffer=this.inputBuffer.slice(Z),ie}}ka.Resampler=Oh;(function(V){var ie=ct&&ct.__createBinding||(Object.create?function($e,be,we,Ne){Ne===void 0&&(Ne=we);var He=Object.getOwnPropertyDescriptor(be,we);(!He||("get"in He?!be.__esModule:He.writable||He.configurable))&&(He={enumerable:!0,get:function(){return be[we]}}),Object.defineProperty($e,Ne,He)}:function($e,be,we,Ne){Ne===void 0&&(Ne=we),$e[Ne]=be[we]}),se=ct&&ct.__setModuleDefault||(Object.create?function($e,be){Object.defineProperty($e,"default",{enumerable:!0,value:be})}:function($e,be){$e.default=be}),Z=ct&&ct.__importStar||function($e){if($e&&$e.__esModule)return $e;var be={};if($e!=null)for(var we in $e)we!=="default"&&Object.prototype.hasOwnProperty.call($e,we)&&ie(be,$e,we);return se(be,$e),be};Object.defineProperty(V,"__esModule",{value:!0}),V.NonRealTimeVAD=V.defaultNonRealTimeVADOptions=void 0;const ue=Z(zh),he=Ea,fe=Ei,ge=rr,z=oi,_e=ws,We=ka;V.defaultNonRealTimeVADOptions={...ge.defaultFrameProcessorOptions,modelURL:he.baseAssetPath+"silero_vad_legacy.onnx",modelFetcher:fe.defaultModelFetcher};class je{static async new(be={}){const we={...V.defaultNonRealTimeVADOptions,...be};(0,ge.validateOptions)(we),we.ortConfig!==void 0&&we.ortConfig(ue);const Ne=()=>we.modelFetcher(we.modelURL),He=await _e.SileroLegacy.new(ue,Ne),ut=new ge.FrameProcessor(He.process,He.reset_state,{positiveSpeechThreshold:we.positiveSpeechThreshold,negativeSpeechThreshold:we.negativeSpeechThreshold,redemptionMs:we.redemptionMs,preSpeechPadMs:we.preSpeechPadMs,minSpeechMs:we.minSpeechMs,submitUserSpeechOnPause:we.submitUserSpeechOnPause},1536/16);return ut.resume(),new this(Ne,ue,we,ut)}constructor(be,we,Ne,He){this.modelFetcher=be,this.ort=we,this.options=Ne,this.frameProcessor=He,this.frameSamples=1536}async*run(be,we){const Ne={nativeSampleRate:we,targetSampleRate:16e3,targetFrameSize:this.frameSamples},He=new We.Resampler(Ne);let ut=0,Oe=0,xe=0;for await(const Ae of He.stream(be)){const de=[];await this.frameProcessor.process(Ae,Ve=>{de.push(Ve)});for(const Ve of de)switch(Ve.msg){case z.Message.SpeechStart:ut=xe*this.frameSamples/16;break;case z.Message.SpeechEnd:Oe=(xe+1)*this.frameSamples/16,yield{audio:Ve.audio,start:ut,end:Oe};break}xe++}const ve=[];this.frameProcessor.endSegment(Ae=>{ve.push(Ae)});for(const Ae of ve)switch(Ae.msg){case z.Message.SpeechEnd:yield{audio:Ae.audio,start:ut,end:xe*this.frameSamples/16}}}}V.NonRealTimeVAD=je})(mc);var tr={};Object.defineProperty(tr,"__esModule",{value:!0});tr.audioFileToArray=tr.encodeWAV=tr.arrayBufferToBase64=tr.minFramesForTargetMS=void 0;function Ah(V,ie,se=16e3){return Math.ceil(V*se/1e3/ie)}tr.minFramesForTargetMS=Ah;function Rh(V){const ie=new Uint8Array(V),se=ie.byteLength,Z=new Array(se);for(let ue=0;ue<se;ue++){const he=ie[ue];if(he===void 0)break;Z[ue]=String.fromCharCode(he)}return btoa(Z.join(""))}tr.arrayBufferToBase64=Rh;function Bh(V,ie=3,se=16e3,Z=1,ue=32){const he=ue/8,fe=Z*he,ge=new ArrayBuffer(44+V.length*he),z=new DataView(ge);return ja(z,0,"RIFF"),z.setUint32(4,36+V.length*he,!0),ja(z,8,"WAVE"),ja(z,12,"fmt "),z.setUint32(16,16,!0),z.setUint16(20,ie,!0),z.setUint16(22,Z,!0),z.setUint32(24,se,!0),z.setUint32(28,se*fe,!0),z.setUint16(32,fe,!0),z.setUint16(34,ue,!0),ja(z,36,"data"),z.setUint32(40,V.length*he,!0),ie===1?Dh(z,44,V):Mh(z,44,V),ge}tr.encodeWAV=Bh;function Mh(V,ie,se){for(let Z=0;Z<se.length;Z++,ie+=4)V.setFloat32(ie,se[Z],!0)}function Dh(V,ie,se){for(let Z=0;Z<se.length;Z++,ie+=2){const ue=Math.max(-1,Math.min(1,se[Z]));V.setInt16(ie,ue<0?ue*32768:ue*32767,!0)}}function ja(V,ie,se){for(let Z=0;Z<se.length;Z++)V.setUint8(ie+Z,se.charCodeAt(Z))}async function Ph(V){const ie=new OfflineAudioContext(1,1,44100),se=new FileReader;let Z=null;if(await new Promise(fe=>{se.addEventListener("loadend",()=>{const ge=se.result;ie.decodeAudioData(ge,z=>{Z=z,ie.startRendering().then(()=>{console.log("Rendering completed successfully"),fe()}).catch(_e=>{console.error("Rendering failed: ",_e)})},z=>{console.log("Error with decoding audio data: ",z)})}),se.readAsArrayBuffer(V)}),Z===null)throw Error("some shit");const ue=Z,he=new Float32Array(ue.length);for(let fe=0;fe<ue.length;fe++)for(let ge=0;ge<ue.numberOfChannels;ge++){const z=ue.getChannelData(ge)[fe],_e=he[fe];if(z===void 0||_e===void 0)throw new Error("sample or out[i] is undefined");he[fe]=_e+z}return{audio:he,sampleRate:ue.sampleRate}}tr.audioFileToArray=Ph;var xc={},Sc={exports:{}};/*!
 * ONNX Runtime Web v1.30.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */(function(V,ie){var se=(()=>{var Z=Object.defineProperty,ue=Object.getOwnPropertyDescriptor,he=Object.getOwnPropertyNames,fe=Object.prototype.hasOwnProperty,ge=(c=>typeof Rt<"u"?Rt:typeof Proxy<"u"?new Proxy(c,{get:(g,$)=>(typeof Rt<"u"?Rt:g)[$]}):c)(function(c){if(typeof Rt<"u")return Rt.apply(this,arguments);throw Error('Dynamic require of "'+c+'" is not supported')}),z=(c,g,$)=>()=>{if($)throw $[0];try{return c&&(g=c(c=0)),g}catch(T){throw $=[T],T}},_e=(c,g)=>{for(var $ in g)Z(c,$,{get:g[$],enumerable:!0})},We=(c,g,$,T)=>{if(g&&typeof g=="object"||typeof g=="function")for(let v of he(g))!fe.call(c,v)&&v!==$&&Z(c,v,{get:()=>g[v],enumerable:!(T=ue(g,v))||T.enumerable});return c},je=c=>We(Z({},"__esModule",{value:!0}),c),$e,be,we,Ne,He,ut=z(()=>{"use strict";$e=new Map,be=[],we=(c,g,$)=>{if(g&&typeof g.init=="function"&&typeof g.createInferenceSessionHandler=="function"){let T=$e.get(c);if(T===void 0)$e.set(c,{backend:g,priority:$});else{if(T.priority>$)return;if(T.priority===$&&T.backend!==g)throw new Error(`cannot register backend "${c}" using priority ${$}`)}if($>=0){let v=be.indexOf(c);v!==-1&&be.splice(v,1);for(let A=0;A<be.length;A++)if($e.get(be[A]).priority<=$){be.splice(A,0,c);return}be.push(c)}return}throw new TypeError("not a valid backend")},Ne=async c=>{let g=$e.get(c);if(!g)return"backend not found.";if(g.initialized)return g.backend;if(g.aborted)return g.error;{let $=!!g.initPromise;try{return $||(g.initPromise=g.backend.init(c)),await g.initPromise,g.initialized=!0,g.backend}catch(T){return $||(g.error=`${T}`,g.aborted=!0),g.error}finally{delete g.initPromise}}},He=async c=>{let g=c.executionProviders||[],$=g.map(R=>typeof R=="string"?R:R.name),T=$.length===0?be:$,v,A=[],k=new Set;for(let R of T){let N=await Ne(R);typeof N=="string"?A.push({name:R,err:N}):(v||(v=N),v===N&&k.add(R))}if(!v)throw new Error(`no available backend found. ERR: ${A.map(R=>`[${R.name}] ${R.err}`).join(", ")}`);for(let{name:R,err:N}of A)$.includes(R)&&console.warn(`removing requested execution provider "${R}" from session options because it is not available: ${N}`);let I=g.filter(R=>k.has(typeof R=="string"?R:R.name));return[v,new Proxy(c,{get:(R,N)=>N==="executionProviders"?I:Reflect.get(R,N)})]}}),Oe=z(()=>{"use strict";ut()}),xe,ve=z(()=>{"use strict";xe="1.30.0"}),Ae,de,Ve=z(()=>{"use strict";ve(),Ae="warning",de={wasm:{},webgl:{},webgpu:{},versions:{common:xe},set logLevel(c){if(c!==void 0){if(typeof c!="string"||["verbose","info","warning","error","fatal"].indexOf(c)===-1)throw new Error(`Unsupported logging level: ${c}`);Ae=c}},get logLevel(){return Ae}},Object.defineProperty(de,"logLevel",{enumerable:!0})}),te,et=z(()=>{"use strict";Ve(),te=de}),ht,Bt,zt=z(()=>{"use strict";ht=(c,g)=>{let $=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);$.width=c.dims[3],$.height=c.dims[2];let T=$.getContext("2d");if(T!=null){let v,A;(g==null?void 0:g.tensorLayout)!==void 0&&g.tensorLayout==="NHWC"?(v=c.dims[2],A=c.dims[3]):(v=c.dims[3],A=c.dims[2]);let k=(g==null?void 0:g.format)!==void 0?g.format:"RGB",I=g==null?void 0:g.norm,R,N;I===void 0||I.mean===void 0?R=[255,255,255,255]:typeof I.mean=="number"?R=[I.mean,I.mean,I.mean,I.mean]:(R=[I.mean[0],I.mean[1],I.mean[2],0],I.mean[3]!==void 0&&(R[3]=I.mean[3])),I===void 0||I.bias===void 0?N=[0,0,0,0]:typeof I.bias=="number"?N=[I.bias,I.bias,I.bias,I.bias]:(N=[I.bias[0],I.bias[1],I.bias[2],0],I.bias[3]!==void 0&&(N[3]=I.bias[3]));let F=A*v,U=0,D=F,Y=F*2,O=-1;k==="RGBA"?(U=0,D=F,Y=F*2,O=F*3):k==="RGB"?(U=0,D=F,Y=F*2):k==="RBG"&&(U=0,Y=F,D=F*2);for(let q=0;q<A;q++)for(let Pe=0;Pe<v;Pe++){let me=(c.data[U++]-N[0])*R[0],ye=(c.data[D++]-N[1])*R[1],Ue=(c.data[Y++]-N[2])*R[2],Q=O===-1?255:(c.data[O++]-N[3])*R[3];T.fillStyle="rgba("+me+","+ye+","+Ue+","+Q+")",T.fillRect(Pe,q,1,1)}if("toDataURL"in $)return $.toDataURL();throw new Error("toDataURL is not supported")}else throw new Error("Can not access image data")},Bt=(c,g)=>{let $=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),T;if($!=null){let v,A,k;(g==null?void 0:g.tensorLayout)!==void 0&&g.tensorLayout==="NHWC"?(v=c.dims[2],A=c.dims[1],k=c.dims[3]):(v=c.dims[3],A=c.dims[2],k=c.dims[1]);let I=g!==void 0&&g.format!==void 0?g.format:"RGB",R=g==null?void 0:g.norm,N,F;R===void 0||R.mean===void 0?N=[255,255,255,255]:typeof R.mean=="number"?N=[R.mean,R.mean,R.mean,R.mean]:(N=[R.mean[0],R.mean[1],R.mean[2],255],R.mean[3]!==void 0&&(N[3]=R.mean[3])),R===void 0||R.bias===void 0?F=[0,0,0,0]:typeof R.bias=="number"?F=[R.bias,R.bias,R.bias,R.bias]:(F=[R.bias[0],R.bias[1],R.bias[2],0],R.bias[3]!==void 0&&(F[3]=R.bias[3]));let U=A*v;if(g!==void 0&&(g.format!==void 0&&k===4&&g.format!=="RGBA"||k===3&&g.format!=="RGB"&&g.format!=="BGR"))throw new Error("Tensor format doesn't match input tensor dims");let D=4,Y=0,O=1,q=2,Pe=3,me=0,ye=U,Ue=U*2,Q=-1;I==="RGBA"?(me=0,ye=U,Ue=U*2,Q=U*3):I==="RGB"?(me=0,ye=U,Ue=U*2):I==="RBG"&&(me=0,Ue=U,ye=U*2),T=$.createImageData(v,A);for(let Et=0;Et<A*v;Y+=D,O+=D,q+=D,Pe+=D,Et++)T.data[Y]=(c.data[me++]-F[0])*N[0],T.data[O]=(c.data[ye++]-F[1])*N[1],T.data[q]=(c.data[Ue++]-F[2])*N[2],T.data[Pe]=Q===-1?255:(c.data[Q++]-F[3])*N[3]}else throw new Error("Can not access image data");return T}}),St,vr,xr,Be,Ct,Sr,ui=z(()=>{"use strict";Er(),St=(c,g)=>{if(c===void 0)throw new Error("Image buffer must be defined");if(g.height===void 0||g.width===void 0)throw new Error("Image height and width must be defined");if(g.tensorLayout==="NHWC")throw new Error("NHWC Tensor layout is not supported yet");let{height:$,width:T}=g,v=g.norm??{mean:255,bias:0},A,k;typeof v.mean=="number"?A=[v.mean,v.mean,v.mean,v.mean]:A=[v.mean[0],v.mean[1],v.mean[2],v.mean[3]??255],typeof v.bias=="number"?k=[v.bias,v.bias,v.bias,v.bias]:k=[v.bias[0],v.bias[1],v.bias[2],v.bias[3]??0];let I=g.format!==void 0?g.format:"RGBA",R=g.tensorFormat!==void 0&&g.tensorFormat!==void 0?g.tensorFormat:"RGB",N=$*T,F=R==="RGBA"?new Float32Array(N*4):new Float32Array(N*3),U=4,D=0,Y=1,O=2,q=3,Pe=0,me=N,ye=N*2,Ue=-1;I==="RGB"&&(U=3,D=0,Y=1,O=2,q=-1),R==="RGBA"?Ue=N*3:R==="RBG"?(Pe=0,ye=N,me=N*2):R==="BGR"&&(ye=0,me=N,Pe=N*2);for(let Q=0;Q<N;Q++,D+=U,O+=U,Y+=U,q+=U)F[Pe++]=(c[D]+k[0])/A[0],F[me++]=(c[Y]+k[1])/A[1],F[ye++]=(c[O]+k[2])/A[2],Ue!==-1&&q!==-1&&(F[Ue++]=(c[q]+k[3])/A[3]);return R==="RGBA"?new Me("float32",F,[1,4,$,T]):new Me("float32",F,[1,3,$,T])},vr=async(c,g)=>{let $=typeof HTMLImageElement<"u"&&c instanceof HTMLImageElement,T=typeof ImageData<"u"&&c instanceof ImageData,v=typeof ImageBitmap<"u"&&c instanceof ImageBitmap,A=typeof c=="string",k,I=g??{},R=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw new Error("Canvas is not supported")},N=F=>typeof HTMLCanvasElement<"u"&&F instanceof HTMLCanvasElement||F instanceof OffscreenCanvas?F.getContext("2d"):null;if($){let F=R();F.width=c.width,F.height=c.height;let U=N(F);if(U!=null){let D=c.height,Y=c.width;if(g!==void 0&&g.resizedHeight!==void 0&&g.resizedWidth!==void 0&&(D=g.resizedHeight,Y=g.resizedWidth),g!==void 0){if(I=g,g.tensorFormat!==void 0)throw new Error("Image input config format must be RGBA for HTMLImageElement");I.tensorFormat="RGBA",I.height=D,I.width=Y}else I.tensorFormat="RGBA",I.height=D,I.width=Y;U.drawImage(c,0,0),k=U.getImageData(0,0,Y,D).data}else throw new Error("Can not access image data")}else if(T){let F,U;if(g!==void 0&&g.resizedWidth!==void 0&&g.resizedHeight!==void 0?(F=g.resizedHeight,U=g.resizedWidth):(F=c.height,U=c.width),g!==void 0&&(I=g),I.format="RGBA",I.height=F,I.width=U,g!==void 0){let D=R();D.width=U,D.height=F;let Y=N(D);if(Y!=null)Y.putImageData(c,0,0),k=Y.getImageData(0,0,U,F).data;else throw new Error("Can not access image data")}else k=c.data}else if(v){if(g===void 0)throw new Error("Please provide image config with format for Imagebitmap");let F=R();F.width=c.width,F.height=c.height;let U=N(F);if(U!=null){let D=c.height,Y=c.width;return U.drawImage(c,0,0,Y,D),k=U.getImageData(0,0,Y,D).data,I.height=D,I.width=Y,St(k,I)}else throw new Error("Can not access image data")}else{if(A)return new Promise((F,U)=>{let D=R(),Y=N(D);if(!c||!Y)return U();let O=new Image;O.crossOrigin="Anonymous",O.src=c,O.onload=()=>{D.width=O.width,D.height=O.height,Y.drawImage(O,0,0,D.width,D.height);let q=Y.getImageData(0,0,D.width,D.height);I.height=D.height,I.width=D.width,F(St(q.data,I))}});throw new Error("Input data provided is not supported - aborted tensor creation")}if(k!==void 0)return St(k,I);throw new Error("Input data provided is not supported - aborted tensor creation")},xr=(c,g)=>{let{width:$,height:T,download:v,dispose:A}=g,k=[1,T,$,4];return new Me({location:"texture",type:"float32",texture:c,dims:k,download:v,dispose:A})},Be=(c,g)=>{let{dataType:$,dims:T,download:v,dispose:A}=g;return new Me({location:"gpu-buffer",type:$??"float32",gpuBuffer:c,dims:T,download:v,dispose:A})},Ct=(c,g)=>{let{dataType:$,dims:T,download:v,dispose:A}=g;return new Me({location:"ml-tensor",type:$??"float32",mlTensor:c,dims:T,download:v,dispose:A})},Sr=(c,g,$)=>new Me({location:"cpu-pinned",type:c,data:g,dims:$??[g.length]})}),ft,Mt,Tr,ki,Qa=z(()=>{"use strict";ft=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),Mt=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),Tr=!1,ki=()=>{if(!Tr){Tr=!0;let c=typeof BigInt64Array<"u"&&BigInt64Array.from,g=typeof BigUint64Array<"u"&&BigUint64Array.from,$=globalThis.Float16Array,T=typeof $<"u"&&$.from;c&&(ft.set("int64",BigInt64Array),Mt.set(BigInt64Array,"int64")),g&&(ft.set("uint64",BigUint64Array),Mt.set(BigUint64Array,"uint64")),T?(ft.set("float16",$),Mt.set($,"float16")):ft.set("float16",Uint16Array)}}}),Ii,zi,Xa=z(()=>{"use strict";Er(),Ii=c=>{let g=1;for(let $=0;$<c.length;$++){let T=c[$];if(typeof T!="number"||!Number.isSafeInteger(T))throw new TypeError(`dims[${$}] must be an integer, got: ${T}`);if(T<0)throw new RangeError(`dims[${$}] must be a non-negative integer, got: ${T}`);g*=T}return g},zi=(c,g)=>{switch(c.location){case"cpu":return new Me(c.type,c.data,g);case"cpu-pinned":return new Me({location:"cpu-pinned",data:c.data,type:c.type,dims:g});case"texture":return new Me({location:"texture",texture:c.texture,type:c.type,dims:g});case"gpu-buffer":return new Me({location:"gpu-buffer",gpuBuffer:c.gpuBuffer,type:c.type,dims:g});case"ml-tensor":return new Me({location:"ml-tensor",mlTensor:c.mlTensor,type:c.type,dims:g});default:throw new Error(`tensorReshape: tensor location ${c.location} is not supported`)}}}),Me,Er=z(()=>{"use strict";zt(),ui(),Qa(),Xa(),Me=class{constructor(c,g,$){ki();let T,v;if(typeof c=="object"&&"location"in c)switch(this.dataLocation=c.location,T=c.type,v=c.dims,c.location){case"cpu-pinned":{let k=ft.get(T);if(!k)throw new TypeError(`unsupported type "${T}" to create tensor from pinned buffer`);if(!(c.data instanceof k))throw new TypeError(`buffer should be of type ${k.name}`);this.cpuData=c.data;break}case"texture":{if(T!=="float32")throw new TypeError(`unsupported type "${T}" to create tensor from texture`);this.gpuTextureData=c.texture,this.downloader=c.download,this.disposer=c.dispose;break}case"gpu-buffer":{if(T!=="float32"&&T!=="float16"&&T!=="int32"&&T!=="int64"&&T!=="uint32"&&T!=="uint8"&&T!=="bool"&&T!=="uint4"&&T!=="int4")throw new TypeError(`unsupported type "${T}" to create tensor from gpu buffer`);this.gpuBufferData=c.gpuBuffer,this.downloader=c.download,this.disposer=c.dispose;break}case"ml-tensor":{if(T!=="float32"&&T!=="float16"&&T!=="int32"&&T!=="int64"&&T!=="uint32"&&T!=="uint64"&&T!=="int8"&&T!=="uint8"&&T!=="bool"&&T!=="uint4"&&T!=="int4")throw new TypeError(`unsupported type "${T}" to create tensor from MLTensor`);this.mlTensorData=c.mlTensor,this.downloader=c.download,this.disposer=c.dispose;break}default:throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let k,I;if(typeof c=="string")if(T=c,I=$,c==="string"){if(!Array.isArray(g))throw new TypeError("A string tensor's data must be a string array.");k=g}else{let R=ft.get(c);if(R===void 0)throw new TypeError(`Unsupported tensor type: ${c}.`);if(Array.isArray(g)){if(c==="float16"&&R===Uint16Array||c==="uint4"||c==="int4")throw new TypeError(`Creating a ${c} tensor from number array is not supported. Please use ${R.name} as data.`);c==="uint64"||c==="int64"?k=R.from(g,BigInt):k=R.from(g)}else if(g instanceof R)k=g;else if(g instanceof Uint8ClampedArray)if(c==="uint8")k=Uint8Array.from(g);else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(c==="float16"&&g instanceof Uint16Array&&R!==Uint16Array)k=new globalThis.Float16Array(g.buffer,g.byteOffset,g.length);else throw new TypeError(`A ${T} tensor's data must be type of ${R}`)}else if(I=g,Array.isArray(c)){if(c.length===0)throw new TypeError("Tensor type cannot be inferred from an empty array.");let R=typeof c[0];if(R==="string")T="string",k=c;else if(R==="boolean")T="bool",k=Uint8Array.from(c);else throw new TypeError(`Invalid element type of data array: ${R}.`)}else if(c instanceof Uint8ClampedArray)T="uint8",k=Uint8Array.from(c);else{let R=Mt.get(c.constructor);if(R===void 0)throw new TypeError(`Unsupported type for tensor data: ${c.constructor}.`);T=R,k=c}if(I===void 0)I=[k.length];else if(!Array.isArray(I))throw new TypeError("A tensor's dims must be a number array");v=I,this.cpuData=k,this.dataLocation="cpu"}let A=Ii(v);if(this.cpuData&&A!==this.cpuData.length&&!((T==="uint4"||T==="int4")&&Math.ceil(A/2)===this.cpuData.length))throw new Error(`Tensor's size(${A}) does not match data length(${this.cpuData.length}).`);this.type=T,this.dims=v,this.size=A}static async fromImage(c,g){return vr(c,g)}static fromTexture(c,g){return xr(c,g)}static fromGpuBuffer(c,g){return Be(c,g)}static fromMLTensor(c,g){return Ct(c,g)}static fromPinnedBuffer(c,g,$){return Sr(c,g,$)}toDataURL(c){return ht(this,c)}toImageData(c){return Bt(this,c)}get data(){if(this.ensureValid(),!this.cpuData)throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw new Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw new Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw new Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(c){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw new Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw new Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let g=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=g,c&&this.disposer&&(this.disposer(),this.disposer=void 0),g}finally{this.isDownloading=!1}}default:throw new Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw new Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw new Error("The tensor is disposed.")}reshape(c){if(this.ensureValid(),this.downloader||this.disposer)throw new Error("Cannot reshape a tensor that owns GPU resource.");return zi(this,c)}}}),qe,Ci=z(()=>{"use strict";Er(),qe=Me}),Zt,kr,tt,Ye,lt,dt,Oi=z(()=>{"use strict";Ve(),Zt=(c,g)=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeStamp(`${c}::ORT::${g}`)},kr=(c,g)=>{var v;let $=((v=new Error().stack)==null?void 0:v.split(/\r\n|\r|\n/g))||[],T=!1;for(let A=0;A<$.length;A++){if(T&&!$[A].includes("TRACE_FUNC")){let k=`FUNC_${c}::${$[A].trim().split(" ")[1]}`;g&&(k+=`::${g}`),Zt("CPU",k);return}$[A].includes("TRACE_FUNC")&&(T=!0)}},tt=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||kr("BEGIN",c)},Ye=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||kr("END",c)},lt=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.time(`ORT::${c}`)},dt=c=>{(typeof de.trace>"u"?!de.wasm.trace:!de.trace)||console.timeEnd(`ORT::${c}`)}}),Ai,Ya=z(()=>{"use strict";ut(),Ci(),Oi(),Ai=class Tc{constructor(g){this.handler=g}async run(g,$,T){tt(),lt("InferenceSession.run");let v={},A={};if(typeof g!="object"||g===null||g instanceof qe||Array.isArray(g))throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let k=!0;if(typeof $=="object"){if($===null)throw new TypeError("Unexpected argument[1]: cannot be null.");if($ instanceof qe)throw new TypeError("'fetches' cannot be a Tensor");if(Array.isArray($)){if($.length===0)throw new TypeError("'fetches' cannot be an empty array.");k=!1;for(let N of $){if(typeof N!="string")throw new TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(N)===-1)throw new RangeError(`'fetches' contains invalid output name: ${N}.`);v[N]=null}if(typeof T=="object"&&T!==null)A=T;else if(typeof T<"u")throw new TypeError("'options' must be an object.")}else{let N=!1,F=Object.getOwnPropertyNames($);for(let U of this.outputNames)if(F.indexOf(U)!==-1){let D=$[U];(D===null||D instanceof qe)&&(N=!0,k=!1,v[U]=D)}if(N){if(typeof T=="object"&&T!==null)A=T;else if(typeof T<"u")throw new TypeError("'options' must be an object.")}else A=$}}else if(typeof $<"u")throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let N of this.inputNames)if(typeof g[N]>"u")throw new Error(`input '${N}' is missing in 'feeds'.`);if(k)for(let N of this.outputNames)v[N]=null;let I=await this.handler.run(g,v,A),R={};for(let N in I)if(Object.hasOwnProperty.call(I,N)){let F=I[N];F instanceof qe?R[N]=F:R[N]=new qe(F.type,F.data,F.dims)}return dt("InferenceSession.run"),Ye(),R}async release(){return this.handler.dispose()}static async create(g,$,T,v){tt(),lt("InferenceSession.create");let A,k={};if(typeof g=="string"){if(A=g,typeof $=="object"&&$!==null)k=$;else if(typeof $<"u")throw new TypeError("'options' must be an object.")}else if(g instanceof Uint8Array){if(A=g,typeof $=="object"&&$!==null)k=$;else if(typeof $<"u")throw new TypeError("'options' must be an object.")}else if(g instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&g instanceof SharedArrayBuffer){let F=g,U=0,D=g.byteLength;if(typeof $=="object"&&$!==null)k=$;else if(typeof $=="number"){if(U=$,!Number.isSafeInteger(U))throw new RangeError("'byteOffset' must be an integer.");if(U<0||U>=F.byteLength)throw new RangeError(`'byteOffset' is out of range [0, ${F.byteLength}).`);if(D=g.byteLength-U,typeof T=="number"){if(D=T,!Number.isSafeInteger(D))throw new RangeError("'byteLength' must be an integer.");if(D<=0||U+D>F.byteLength)throw new RangeError(`'byteLength' is out of range (0, ${F.byteLength-U}].`);if(typeof v=="object"&&v!==null)k=v;else if(typeof v<"u")throw new TypeError("'options' must be an object.")}else if(typeof T<"u")throw new TypeError("'byteLength' must be a number.")}else if(typeof $<"u")throw new TypeError("'options' must be an object.");A=new Uint8Array(F,U,D)}else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[I,R]=await He(k),N=await I.createInferenceSessionHandler(A,R);return dt("InferenceSession.create"),Ye(),new Tc(N)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}get inputMetadata(){return this.handler.inputMetadata}get outputMetadata(){return this.handler.outputMetadata}}}),Ir,Ja=z(()=>{"use strict";Ya(),Ir=Ai}),en=z(()=>{"use strict"}),tn=z(()=>{"use strict"}),rn=z(()=>{"use strict"}),an=z(()=>{"use strict"}),Ri={};_e(Ri,{InferenceSession:()=>Ir,TRACE:()=>Zt,TRACE_EVENT_BEGIN:()=>lt,TRACE_EVENT_END:()=>dt,TRACE_FUNC_BEGIN:()=>tt,TRACE_FUNC_END:()=>Ye,Tensor:()=>qe,env:()=>te,registerBackend:()=>we});var Je=z(()=>{"use strict";Oe(),et(),Ja(),Ci(),en(),tn(),Oi(),rn(),an()}),zr=z(()=>{"use strict"}),Bi={};_e(Bi,{default:()=>Mi});var Cr,Or,Mi,nn=z(()=>{"use strict";var c;ea(),_t(),Dr(),Cr="ort-wasm-proxy-worker",Or=((c=globalThis.self)==null?void 0:c.name)===Cr,Or&&(self.onmessage=g=>{let{type:$,in:T}=g.data;try{switch($){case"init-wasm":Nr(T.wasm).then(()=>{di(T).then(()=>{postMessage({type:$})},v=>{postMessage({type:$,err:v})})},v=>{postMessage({type:$,err:v})});break;case"init-ep":{let{epName:v,env:A}=T;pi(A,v).then(()=>{postMessage({type:$})},k=>{postMessage({type:$,err:k})});break}case"copy-from":{let{buffer:v}=T,A=Se(v);postMessage({type:$,out:A});break}case"create":{let{model:v,options:A}=T;Tt(v,A).then(k=>{postMessage({type:$,out:k})},k=>{postMessage({type:$,err:k})});break}case"release":fi(T),postMessage({type:$});break;case"run":{let{sessionId:v,inputIndices:A,inputs:k,outputIndices:I,options:R}=T;M(v,A,k,I,new Array(I.length).fill(null),R).then(N=>{N.some(F=>F[3]!=="cpu")?postMessage({type:$,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:$,out:N},mi([...k,...N]))},N=>{postMessage({type:$,err:N})});break}case"end-profiling":pr(T),postMessage({type:$});break;default:}}catch(v){postMessage({type:$,err:v})}}),Mi=Or?null:g=>new Worker(g??De,{type:"classic",name:Cr})}),Di,Pi,De,Ar,ir,Ui,Ni,Rr,Li,Br,Vi,Mr,Fi,Dr=z(()=>{"use strict";zr(),Di=typeof location>"u"?void 0:location.origin,Pi=()=>{var c,g;return typeof document<"u"?(c=document.currentScript)==null?void 0:c.src:typeof self<"u"?(g=self.location)==null?void 0:g.href:void 0},De=Pi(),Ar=()=>{if(De&&!De.startsWith("blob:"))return De.substring(0,De.lastIndexOf("/")+1)},ir=(c,g)=>{try{let $=g??De;return($?new URL(c,$):new URL(c)).origin===Di}catch{return!1}},Ui=(c,g)=>{let $=g??De;try{return($?new URL(c,$):new URL(c)).href}catch{return}},Ni=(c,g)=>`${g??"./"}${c}`,Rr=async c=>{let g=await(await fetch(c,{credentials:"same-origin"})).blob();return URL.createObjectURL(g)},Li=async c=>(await import(c)).default,Br=(nn(),je(Bi)).default,Vi=async()=>{if(!De)throw new Error("Failed to load proxy worker: cannot determine the script source URL.");if(ir(De))return[void 0,Br()];let c=await Rr(De);return[c,Br(c)]},Mr=void 0,Fi=async(c,g,$,T)=>{let v=Mr&&!(c||g);if(v)if(De)v=ir(De)||T&&!$;else if(T&&!$)v=!0;else throw new Error("cannot determine the script source URL.");if(v)return[void 0,Mr];{let A="ort-wasm-simd-threaded.mjs",k=c??Ui(A,g),I=$&&k&&!ir(k,g),R=I?await Rr(k):k??Ni(A,g);return[I?R:void 0,await Li(R)]}}}),Pr,ar,Dt,Ur,qi,Gi,Wi,Nr,pe,_t=z(()=>{"use strict";Dr(),ar=!1,Dt=!1,Ur=!1,qi=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},Gi=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},Wi=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,19,1,17,0,65,1,253,15,65,2,253,15,65,3,253,15,253,147,2,11]))}catch{return!1}},Nr=async c=>{if(ar)return Promise.resolve();if(Dt)throw new Error("multiple calls to 'initializeWebAssembly()' detected.");if(Ur)throw new Error("previous call to 'initializeWebAssembly()' failed.");Dt=!0;let g=c.initTimeout,$=c.numThreads;if(c.simd!==!1){if(c.simd==="relaxed"){if(!Wi())throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.")}else if(!Gi())throw new Error("WebAssembly SIMD is not supported in the current environment.")}let T=qi();$>1&&!T&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+$+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),c.numThreads=$=1);let v=c.wasmPaths,A=typeof v=="string"?v:void 0,k=v==null?void 0:v.mjs,I=(k==null?void 0:k.href)??k,R=v==null?void 0:v.wasm,N=(R==null?void 0:R.href)??R,F=c.wasmBinary,[U,D]=await Fi(I,A,$>1,!!F||!!N),Y=!1,O=[];if(g>0&&O.push(new Promise(q=>{setTimeout(()=>{Y=!0,q()},g)})),O.push(new Promise((q,Pe)=>{let me={numThreads:$};if(F)me.wasmBinary=F,me.locateFile=ye=>ye;else if(N||A)me.locateFile=ye=>N??A+ye;else if(I&&I.indexOf("blob:")!==0)me.locateFile=ye=>new URL(ye,I).href;else if(U){let ye=Ar();ye&&(me.locateFile=Ue=>ye+Ue)}D(me).then(ye=>{Dt=!1,ar=!0,Pr=ye,q(),U&&URL.revokeObjectURL(U)},ye=>{Dt=!1,Ur=!0,Pe(ye)})})),await Promise.race(O),Y)throw new Error(`WebAssembly backend initializing failed due to timeout: ${g}ms`)},pe=()=>{if(ar&&Pr)return Pr;throw new Error("WebAssembly is not initialized yet.")}}),Ge,nr,ne,Lr=z(()=>{"use strict";_t(),Ge=(c,g)=>{let $=pe(),T=$.lengthBytesUTF8(c)+1,v=$._malloc(T);return $.stringToUTF8(c,v,T),g.push(v),v},nr=(c,g,$,T)=>{if(typeof c=="object"&&c!==null){if($.has(c))throw new Error("Circular reference in options");$.add(c)}Object.entries(c).forEach(([v,A])=>{let k=g?g+v:v;if(typeof A=="object")nr(A,k+".",$,T);else if(typeof A=="string"||typeof A=="number")T(k,A.toString());else if(typeof A=="boolean")T(k,A?"1":"0");else throw new Error(`Can't handle extra config type: ${typeof A}`)})},ne=c=>{let g=pe(),$=g.stackSave();try{let T=g.PTR_SIZE,v=g.stackAlloc(2*T);g._OrtGetLastError(v,v+T);let A=Number(g.getValue(v,T===4?"i32":"i64")),k=g.getValue(v+T,"*"),I=k?g.UTF8ToString(k):"";throw new Error(`${c} ERROR_CODE: ${A}, ERROR_MESSAGE: ${I}`)}finally{g.stackRestore($)}}}),ji,sn=z(()=>{"use strict";_t(),Lr(),ji=c=>{let g=pe(),$=0,T=[],v=c||{};try{if((c==null?void 0:c.logSeverityLevel)===void 0)v.logSeverityLevel=2;else if(typeof c.logSeverityLevel!="number"||!Number.isInteger(c.logSeverityLevel)||c.logSeverityLevel<0||c.logSeverityLevel>4)throw new Error(`log severity level is not valid: ${c.logSeverityLevel}`);if((c==null?void 0:c.logVerbosityLevel)===void 0)v.logVerbosityLevel=0;else if(typeof c.logVerbosityLevel!="number"||!Number.isInteger(c.logVerbosityLevel))throw new Error(`log verbosity level is not valid: ${c.logVerbosityLevel}`);(c==null?void 0:c.terminate)===void 0&&(v.terminate=!1);let A=0;return(c==null?void 0:c.tag)!==void 0&&(A=Ge(c.tag,T)),$=g._OrtCreateRunOptions(v.logSeverityLevel,v.logVerbosityLevel,!!v.terminate,A),$===0&&ne("Can't create run options."),(c==null?void 0:c.extra)!==void 0&&nr(c.extra,"",new WeakSet,(k,I)=>{let R=Ge(k,T),N=Ge(I,T);g._OrtAddRunConfigEntry($,R,N)!==0&&ne(`Can't set a run config entry: ${k} - ${I}.`)}),[$,T]}catch(A){throw $!==0&&g._OrtReleaseRunOptions($),T.forEach(k=>g._free(k)),A}}}),Hi,Ki,Zi,mt,Qi,Xi,on=z(()=>{"use strict";_t(),Lr(),Hi=c=>{switch(c){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"layout":return 3;case"all":return 99;default:throw new Error(`unsupported graph optimization level: ${c}`)}},Ki=c=>{switch(c){case"sequential":return 0;case"parallel":return 1;default:throw new Error(`unsupported execution mode: ${c}`)}},Zi=c=>{c.extra||(c.extra={}),c.extra.session||(c.extra.session={});let g=c.extra.session;g.use_ort_model_bytes_directly||(g.use_ort_model_bytes_directly="1"),c.executionProviders&&c.executionProviders.some($=>(typeof $=="string"?$:$.name)==="webgpu")&&(c.enableMemPattern=!1)},mt=(c,g,$,T)=>{let v=Ge(g,T),A=Ge($,T);pe()._OrtAddSessionConfigEntry(c,v,A)!==0&&ne(`Can't set a session config entry: ${g} - ${$}.`)},Qi=async(c,g,$)=>{let T=g.executionProviders;for(let v of T){let A=typeof v=="string"?v:v.name,k=[];switch(A){case"webnn":if(A="WEBNN",mt(c,"session.disable_quant_qdq","1",$),mt(c,"session.disable_qdq_constant_folding","1",$),typeof v!="string"){let U=v==null?void 0:v.deviceType;U&&mt(c,"deviceType",U,$)}break;case"webgpu":if(A="JS",typeof v!="string"){let U=v;if(U!=null&&U.preferredLayout){if(U.preferredLayout!=="NCHW"&&U.preferredLayout!=="NHWC")throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${U.preferredLayout}`);mt(c,"preferredLayout",U.preferredLayout,$)}}break;case"wasm":case"cpu":continue;default:throw new Error(`not supported execution provider: ${A}`)}let I=Ge(A,$),R=k.length,N=0,F=0;if(R>0){N=pe()._malloc(R*pe().PTR_SIZE),$.push(N),F=pe()._malloc(R*pe().PTR_SIZE),$.push(F);for(let U=0;U<R;U++)pe().setValue(N+U*pe().PTR_SIZE,k[U][0],"*"),pe().setValue(F+U*pe().PTR_SIZE,k[U][1],"*")}await pe()._OrtAppendExecutionProvider(c,I,N,F,R)!==0&&ne(`Can't append execution provider: ${A}.`)}},Xi=async c=>{let g=pe(),$=0,T=[],v=c||{};Zi(v);try{let A=Hi(v.graphOptimizationLevel??"all"),k=Ki(v.executionMode??"sequential"),I=typeof v.logId=="string"?Ge(v.logId,T):0,R=v.logSeverityLevel??2;if(!Number.isInteger(R)||R<0||R>4)throw new Error(`log severity level is not valid: ${R}`);let N=v.logVerbosityLevel??0;if(!Number.isInteger(N)||N<0||N>4)throw new Error(`log verbosity level is not valid: ${N}`);let F=typeof v.optimizedModelFilePath=="string"?Ge(v.optimizedModelFilePath,T):0;if($=g._OrtCreateSessionOptions(A,!!v.enableCpuMemArena,!!v.enableMemPattern,k,!!v.enableProfiling,0,I,R,N,F),$===0&&ne("Can't create session options."),v.executionProviders&&await Qi($,v,T),v.enableGraphCapture!==void 0){if(typeof v.enableGraphCapture!="boolean")throw new Error(`enableGraphCapture must be a boolean value: ${v.enableGraphCapture}`);mt($,"enableGraphCapture",v.enableGraphCapture.toString(),T)}if(v.freeDimensionOverrides)for(let[U,D]of Object.entries(v.freeDimensionOverrides)){if(typeof U!="string")throw new Error(`free dimension override name must be a string: ${U}`);if(typeof D!="number"||!Number.isInteger(D)||D<0)throw new Error(`free dimension override value must be a non-negative integer: ${D}`);let Y=Ge(U,T);g._OrtAddFreeDimensionOverride($,Y,D)!==0&&ne(`Can't set a free dimension override: ${U} - ${D}.`)}return v.extra!==void 0&&nr(v.extra,"",new WeakSet,(U,D)=>{mt($,U,D,T)}),[$,T]}catch(A){throw $!==0&&g._OrtReleaseSessionOptions($)!==0&&ne("Can't release session options."),T.forEach(k=>g._free(k)),A}}}),wt,$t,bt,Vr,Fr,qr,Gr,li,le=z(()=>{"use strict";wt=c=>{switch(c){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw new Error(`unsupported data type: ${c}`)}},$t=c=>{switch(c){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw new Error(`unsupported data type: ${c}`)}},bt=(c,g)=>{let $=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,.5,.5][c],T=typeof g=="number"?g:g.reduce((v,A)=>v*A,1);return $>0?Math.ceil(T*$):void 0},Vr=c=>{switch(c){case"float16":return typeof Float16Array<"u"?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw new Error(`unsupported type: ${c}`)}},Fr=c=>{switch(c){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw new Error(`unsupported logging level: ${c}`)}},qr=c=>c==="float32"||c==="float16"||c==="int32"||c==="int64"||c==="uint32"||c==="uint8"||c==="bool"||c==="uint4"||c==="int4",Gr=c=>c==="float32"||c==="float16"||c==="int32"||c==="int64"||c==="uint32"||c==="uint64"||c==="int8"||c==="uint8"||c==="bool"||c==="uint4"||c==="int4",li=c=>{switch(c){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw new Error(`unsupported data location: ${c}`)}}}),Wr,Yi=z(()=>{"use strict";zr(),Wr=async c=>{if(typeof c=="string"){let g=await fetch(c);if(!g.ok)throw new Error(`failed to load external data file: ${c}`);let $=g.headers.get("Content-Length"),T=$?parseInt($,10):0;if(T<1073741824)return new Uint8Array(await g.arrayBuffer());{if(!g.body)throw new Error(`failed to load external data file: ${c}, no response body.`);let v=g.body.getReader(),A;try{A=new ArrayBuffer(T)}catch(I){if(I instanceof RangeError){let R=Math.ceil(T/65536);A=new WebAssembly.Memory({initial:R,maximum:R}).buffer}else throw I}let k=0;for(;;){let{done:I,value:R}=await v.read();if(I)break;let N=R.byteLength;new Uint8Array(A,k,N).set(R),k+=N}return new Uint8Array(A,0,T)}}else return c instanceof Blob?new Uint8Array(await c.arrayBuffer()):c instanceof Uint8Array?c:new Uint8Array(c)}}),Ji,di,pi,Qt,ci,hi,Se,Tt,fi,Xt,M,pr,mi,ea=z(()=>{"use strict";Je(),sn(),on(),le(),_t(),Lr(),Yi(),Ji=(c,g)=>{pe()._OrtInit(c,g)!==0&&ne("Can't initialize onnxruntime.")},di=async c=>{Ji(c.wasm.numThreads,Fr(c.logLevel))},pi=async(c,g)=>{var T,v;(v=(T=pe()).asyncInit)==null||v.call(T);let $=c.webgpu.adapter;if(g==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw new Error("WebGPU is not supported in current environment");if($){if(typeof $.limits!="object"||typeof $.features!="object"||typeof $.requestDevice!="function")throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let A=c.webgpu.powerPreference;if(A!==void 0&&A!=="low-power"&&A!=="high-performance")throw new Error(`Invalid powerPreference setting: "${A}"`);let k=c.webgpu.forceFallbackAdapter;if(k!==void 0&&typeof k!="boolean")throw new Error(`Invalid forceFallbackAdapter setting: "${k}"`);if($=await navigator.gpu.requestAdapter({powerPreference:A,forceFallbackAdapter:k}),!$)throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}}if(g==="webnn"&&(typeof navigator>"u"||!navigator.ml))throw new Error("WebNN is not supported in current environment")},Qt=new Map,ci=c=>{let g=pe(),$=g.stackSave();try{let T=g.PTR_SIZE,v=g.stackAlloc(2*T);g._OrtGetInputOutputCount(c,v,v+T)!==0&&ne("Can't get session input/output count.");let A=T===4?"i32":"i64";return[Number(g.getValue(v,A)),Number(g.getValue(v+T,A))]}finally{g.stackRestore($)}},hi=(c,g)=>{let $=pe(),T=$.stackSave(),v=0;try{let A=$.PTR_SIZE,k=$.stackAlloc(2*A);$._OrtGetInputOutputMetadata(c,g,k,k+A)!==0&&ne("Can't get session input/output metadata.");let I=Number($.getValue(k,"*"));v=Number($.getValue(k+A,"*"));let R=$.HEAP32[v/4];if(R===0)return[I,0];let N=$.HEAPU32[v/4+1],F=[];for(let U=0;U<N;U++){let D=Number($.getValue(v+8+U*A,"*"));F.push(D!==0?$.UTF8ToString(D):Number($.getValue(v+8+(U+N)*A,"*")))}return[I,R,F]}finally{$.stackRestore(T),v!==0&&$._OrtFree(v)}},Se=c=>{let g=pe(),$=g._malloc(c.byteLength);if($===0)throw new Error(`Can't create a session. failed to allocate a buffer of size ${c.byteLength}.`);return g.HEAPU8.set(c,$),[$,c.byteLength]},Tt=async(c,g)=>{var U,D,Y;let $,T,v=pe();Array.isArray(c)?[$,T]=c:c.buffer===v.HEAPU8.buffer?[$,T]=[c.byteOffset,c.byteLength]:[$,T]=Se(c);let A=0,k=0,I=0,R=[],N=[],F=[];try{if([k,R]=await Xi(g),(g==null?void 0:g.externalData)&&v.mountExternalData){let Le=[];for(let Ie of g.externalData){let rt=typeof Ie=="string"?Ie:Ie.path,vt=typeof Ie=="string"?Ie:Ie.data;Le.push(Wr(vt).then(it=>{v.mountExternalData(rt,it)}))}await Promise.all(Le)}for(let Le of(g==null?void 0:g.executionProviders)??[])if((typeof Le=="string"?Le:Le.name)==="webnn"){if(v.shouldTransferToMLTensor=!1,typeof Le!="string"){let Ie=Le,rt=Ie==null?void 0:Ie.context,vt=Ie==null?void 0:Ie.gpuDevice,it=Ie==null?void 0:Ie.deviceType,at=Ie==null?void 0:Ie.powerPreference;rt?v.currentContext=rt:vt?v.currentContext=await v.webnnCreateMLContext(vt):v.currentContext=await v.webnnCreateMLContext({deviceType:it,powerPreference:at})}else v.currentContext=await v.webnnCreateMLContext();break}A=await v._OrtCreateSession($,T,k),(U=v.webgpuOnCreateSession)==null||U.call(v,A),A===0&&ne("Can't create a session."),(D=v.jsepOnCreateSession)==null||D.call(v),v.currentContext&&(v.webnnRegisterMLContext(A,v.currentContext),v.currentContext=void 0,v.shouldTransferToMLTensor=!0);let[O,q]=ci(A),Pe=!!(g!=null&&g.enableGraphCapture),me=[],ye=[],Ue=[],Q=[],Et=[];for(let Le=0;Le<O;Le++){let[Ie,rt,vt]=hi(A,Le);Ie===0&&ne("Can't get an input name."),N.push(Ie);let it=v.UTF8ToString(Ie);me.push(it),Ue.push(rt===0?{name:it,isTensor:!1}:{name:it,isTensor:!0,type:$t(rt),shape:vt})}for(let Le=0;Le<q;Le++){let[Ie,rt,vt]=hi(A,Le+O);Ie===0&&ne("Can't get an output name."),F.push(Ie);let it=v.UTF8ToString(Ie);ye.push(it),Q.push(rt===0?{name:it,isTensor:!1}:{name:it,isTensor:!0,type:$t(rt),shape:vt})}return Qt.set(A,[A,N,F,null,Pe,!1]),[A,me,ye,Ue,Q]}catch(O){throw N.forEach(q=>v._OrtFree(q)),F.forEach(q=>v._OrtFree(q)),I!==0&&v._OrtReleaseBinding(I)!==0&&ne("Can't release IO binding."),A!==0&&v._OrtReleaseSession(A)!==0&&ne("Can't release session."),O}finally{v._free($),k!==0&&v._OrtReleaseSessionOptions(k)!==0&&ne("Can't release session options."),R.forEach(O=>v._free(O)),(Y=v.unmountExternalData)==null||Y.call(v)}},fi=c=>{var R,N,F;let g=pe(),$=Qt.get(c);if(!$)throw new Error(`cannot release session. invalid session id: ${c}`);let[T,v,A,k,I]=$;k&&(I&&g._OrtClearBoundOutputs(k.handle)!==0&&ne("Can't clear bound outputs."),g._OrtReleaseBinding(k.handle)!==0&&ne("Can't release IO binding.")),(R=g.jsepOnReleaseSession)==null||R.call(g,c),(N=g.webnnOnReleaseSession)==null||N.call(g,c),(F=g.webgpuOnReleaseSession)==null||F.call(g,c),v.forEach(U=>g._OrtFree(U)),A.forEach(U=>g._OrtFree(U)),g._OrtReleaseSession(T)!==0&&ne("Can't release session."),Qt.delete(c)},Xt=async(c,g,$,T,v,A,k=!1)=>{if(!c){g.push(0);return}let I=pe(),R=I.PTR_SIZE,N=c[0],F=c[1],U=c[3],D=U,Y,O;if(N==="string"&&(U==="gpu-buffer"||U==="ml-tensor"))throw new Error("String tensor is not supported on GPU.");if(k&&U!=="gpu-buffer")throw new Error(`External buffer must be provided for input/output index ${A} when enableGraphCapture is true.`);if(U==="gpu-buffer"){let me=c[2].gpuBuffer;O=bt(wt(N),F);{let ye=I.jsepRegisterBuffer;if(!ye)throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');Y=ye(T,A,me,O)}}else if(U==="ml-tensor"){let me=c[2].mlTensor;O=bt(wt(N),F);let ye=I.webnnRegisterMLTensor;if(!ye)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');Y=ye(T,me,wt(N),F)}else{let me=c[2];if(Array.isArray(me)){O=R*me.length,Y=I._malloc(O),$.push(Y);for(let ye=0;ye<me.length;ye++){if(typeof me[ye]!="string")throw new TypeError(`tensor data at index ${ye} is not a string`);I.setValue(Y+ye*R,Ge(me[ye],$),"*")}}else{let ye=I.webnnIsGraphInput,Ue=I.webnnIsGraphOutput;if(N!=="string"&&ye&&Ue){let Q=I.UTF8ToString(v);if(ye(T,Q)||Ue(T,Q)){let Et=wt(N);O=bt(Et,F),D="ml-tensor";let Le=I.webnnCreateTemporaryTensor,Ie=I.webnnUploadTensor;if(!Le||!Ie)throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');let rt=await Le(T,Et,F);Ie(rt,new Uint8Array(me.buffer,me.byteOffset,me.byteLength)),Y=rt}else O=me.byteLength,Y=I._malloc(O),$.push(Y),I.HEAPU8.set(new Uint8Array(me.buffer,me.byteOffset,O),Y)}else O=me.byteLength,Y=I._malloc(O),$.push(Y),I.HEAPU8.set(new Uint8Array(me.buffer,me.byteOffset,O),Y)}}let q=I.stackSave(),Pe=I.stackAlloc(4*F.length);try{F.forEach((ye,Ue)=>I.setValue(Pe+Ue*R,ye,R===4?"i32":"i64"));let me=I._OrtCreateTensor(wt(N),Y,O,Pe,F.length,li(D));me===0&&ne(`Can't create tensor for input/output. session=${T}, index=${A}.`),g.push(me)}finally{I.stackRestore(q)}},M=async(c,g,$,T,v,A)=>{var ua,la,Nt;let k=pe(),I=k.PTR_SIZE,R=Qt.get(c);if(!R)throw new Error(`cannot run inference. invalid session id: ${c}`);let N=R[0],F=R[1],U=R[2],D=R[3],Y=R[4],O=R[5],q=g.length,Pe=T.length,me=0,ye=[],Ue=[],Q=[],Et=[],Le=[],Ie=k.stackSave(),rt=k.stackAlloc(q*I),vt=k.stackAlloc(q*I),it=k.stackAlloc(Pe*I),at=k.stackAlloc(Pe*I);try{[me,ye]=ji(A),lt("wasm prepareInputOutputTensor");for(let Te=0;Te<q;Te++)await Xt($[Te],Ue,Et,c,F[g[Te]],g[Te],Y);for(let Te=0;Te<Pe;Te++)await Xt(v[Te],Q,Et,c,U[T[Te]],q+T[Te],Y);dt("wasm prepareInputOutputTensor");for(let Te=0;Te<q;Te++)k.setValue(rt+Te*I,Ue[Te],"*"),k.setValue(vt+Te*I,F[g[Te]],"*");for(let Te=0;Te<Pe;Te++)k.setValue(it+Te*I,Q[Te],"*"),k.setValue(at+Te*I,U[T[Te]],"*");(ua=k.jsepOnRunStart)==null||ua.call(k,N),(la=k.webnnOnRunStart)==null||la.call(k,N);let kt;kt=await k._OrtRun(N,vt,rt,q,at,Pe,it,me),kt!==0&&ne("failed to call OrtRun().");let Ot=[],da=[];lt("wasm ProcessOutputTensor");for(let Te=0;Te<Pe;Te++){let It=Number(k.getValue(it+Te*I,"*"));if(It===Q[Te]||Le.includes(Q[Te])){Ot.push(v[Te]),It!==Q[Te]&&k._OrtReleaseTensor(It)!==0&&ne("Can't release tensor.");continue}let Ca=k.stackSave(),Lt=k.stackAlloc(4*I),Qr=!1,Ke,pt=0;try{k._OrtGetTensorData(It,Lt,Lt+I,Lt+2*I,Lt+3*I)!==0&&ne(`Can't access output tensor data on index ${Te}.`);let gt=I===4?"i32":"i64",Xr=Number(k.getValue(Lt,gt));pt=k.getValue(Lt+I,"*");let pa=k.getValue(Lt+I*2,"*"),Oa=Number(k.getValue(Lt+I*3,gt)),Vt=[];for(let Ze=0;Ze<Oa;Ze++)Vt.push(Number(k.getValue(pa+Ze*I,gt)));k._OrtFree(pa)!==0&&ne("Can't free memory for tensor dims.");let Ft=Vt.reduce((Ze,Fe)=>Ze*Fe,1);Ke=$t(Xr);let fr=D==null?void 0:D.outputPreferredLocations[T[Te]];if(Ke==="string"){if(fr==="gpu-buffer"||fr==="ml-tensor")throw new Error("String tensor is not supported on GPU.");let Ze=[];for(let Fe=0;Fe<Ft;Fe++){let At=k.getValue(pt+Fe*I,"*"),Aa=k.getValue(pt+(Fe+1)*I,"*"),ln=Fe===Ft-1?void 0:Aa-At;Ze.push(k.UTF8ToString(At,ln))}Ot.push([Ke,Vt,Ze,"cpu"])}else if(fr==="gpu-buffer"&&Ft>0){let Ze=k.jsepGetBuffer;if(!Ze)throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let Fe=Ze(pt),At=bt(Xr,Ft);if(At===void 0||!qr(Ke))throw new Error(`Unsupported data type: ${Ke}`);Qr=!0,Ot.push([Ke,Vt,{gpuBuffer:Fe,download:k.jsepCreateDownloader(Fe,At,Ke),dispose:()=>{k._OrtReleaseTensor(It)!==0&&ne("Can't release tensor.")}},"gpu-buffer"])}else if(fr==="ml-tensor"&&Ft>0){let Ze=k.webnnEnsureTensor,Fe=k.webnnIsGraphInputOutputTypeSupported;if(!Ze||!Fe)throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(bt(Xr,Ft)===void 0||!Gr(Ke))throw new Error(`Unsupported data type: ${Ke}`);if(!Fe(c,Ke,!1))throw new Error(`preferredLocation "ml-tensor" for ${Ke} output is not supported by current WebNN Context.`);let At=await Ze(c,pt,Xr,Vt,!1);Qr=!0,Ot.push([Ke,Vt,{mlTensor:At,download:k.webnnCreateMLTensorDownloader(pt,Ke),dispose:()=>{k.webnnReleaseTensorId(pt),k._OrtReleaseTensor(It)}},"ml-tensor"])}else if(fr==="ml-tensor-cpu-output"&&Ft>0){let Ze=k.webnnCreateMLTensorDownloader(pt,Ke)(),Fe=Ot.length;Qr=!0,da.push((async()=>{let At=[Fe,await Ze];return k.webnnReleaseTensorId(pt),k._OrtReleaseTensor(It),At})()),Ot.push([Ke,Vt,[],"cpu"])}else{let Ze=Vr(Ke),Fe=new Ze(Ft);new Uint8Array(Fe.buffer,Fe.byteOffset,Fe.byteLength).set(k.HEAPU8.subarray(pt,pt+Fe.byteLength)),Ot.push([Ke,Vt,Fe,"cpu"])}}finally{k.stackRestore(Ca),Ke==="string"&&pt&&k._free(pt),Qr||k._OrtReleaseTensor(It)}}D&&!Y&&(k._OrtClearBoundOutputs(D.handle)!==0&&ne("Can't clear bound outputs."),Qt.set(c,[N,F,U,D,Y,!1]));for(let[Te,It]of await Promise.all(da))Ot[Te][2]=It;return dt("wasm ProcessOutputTensor"),Ot}finally{(Nt=k.webnnOnRunEnd)==null||Nt.call(k,N),k.stackRestore(Ie),Ue.forEach(kt=>k._OrtReleaseTensor(kt)),Q.forEach(kt=>k._OrtReleaseTensor(kt)),Et.forEach(kt=>k._free(kt)),me!==0&&k._OrtReleaseRunOptions(me),ye.forEach(kt=>k._free(kt))}},pr=c=>{let g=pe(),$=Qt.get(c);if(!$)throw new Error("invalid session id");let T=$[0],v=g._OrtEndProfiling(T);v===0&&ne("Can't get an profile file name."),g._OrtFree(v)},mi=c=>{let g=[];for(let $ of c){let T=$[2];!Array.isArray(T)&&"buffer"in T&&g.push(T.buffer)}return g}}),Pt,re,Yt,cr,sr,jr,Hr,Kr,Ut,Jt,gi,yi,_i,ta,ra,Ia,hr,ia,aa=z(()=>{"use strict";Je(),ea(),_t(),Dr(),Pt=()=>!!te.wasm.proxy&&typeof document<"u",Yt=!1,cr=!1,sr=!1,Kr=new Map,Ut=(c,g)=>{let $=Kr.get(c);$?$.push(g):Kr.set(c,[g])},Jt=()=>{if(Yt||!cr||sr||!re)throw new Error("worker not ready")},gi=c=>{switch(c.data.type){case"init-wasm":Yt=!1,c.data.err?(sr=!0,Hr[1](c.data.err)):(cr=!0,Hr[0]()),jr&&(URL.revokeObjectURL(jr),jr=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let g=Kr.get(c.data.type);c.data.err?g.shift()[1](c.data.err):g.shift()[0](c.data.out);break}default:}},yi=async()=>{if(!cr){if(Yt)throw new Error("multiple calls to 'initWasm()' detected.");if(sr)throw new Error("previous call to 'initWasm()' failed.");if(Yt=!0,Pt())return new Promise((c,g)=>{re==null||re.terminate(),Vi().then(([$,T])=>{try{re=T,re.onerror=A=>g(A),re.onmessage=gi,Hr=[c,g];let v={type:"init-wasm",in:te};if(!v.in.wasm.wasmPaths&&$){let A=Ar();A&&(v.in.wasm.wasmPaths=A)}re.postMessage(v),jr=$}catch(v){g(v)}},g)});try{await Nr(te.wasm),await di(te),cr=!0}catch(c){throw sr=!0,c}finally{Yt=!1}}},_i=async c=>{if(Pt())return Jt(),new Promise((g,$)=>{Ut("init-ep",[g,$]);let T={type:"init-ep",in:{epName:c,env:te}};re.postMessage(T)});await pi(te,c)},ta=async c=>Pt()?(Jt(),new Promise((g,$)=>{Ut("copy-from",[g,$]);let T={type:"copy-from",in:{buffer:c}};re.postMessage(T,[c.buffer])})):Se(c),ra=async(c,g)=>{if(Pt()){if(g!=null&&g.preferredOutputLocation)throw new Error('session option "preferredOutputLocation" is not supported for proxy.');return Jt(),new Promise(($,T)=>{Ut("create",[$,T]);let v={type:"create",in:{model:c,options:{...g}}},A=[];c instanceof Uint8Array&&A.push(c.buffer),re.postMessage(v,A)})}else return Tt(c,g)},Ia=async c=>{if(Pt())return Jt(),new Promise((g,$)=>{Ut("release",[g,$]);let T={type:"release",in:c};re.postMessage(T)});fi(c)},hr=async(c,g,$,T,v,A)=>{if(Pt()){if($.some(k=>k[3]!=="cpu"))throw new Error("input tensor on GPU is not supported for proxy.");if(v.some(k=>k))throw new Error("pre-allocated output tensor is not supported for proxy.");return Jt(),new Promise((k,I)=>{Ut("run",[k,I]);let R=$,N={type:"run",in:{sessionId:c,inputIndices:g,inputs:R,outputIndices:T,options:A}};re.postMessage(N,mi(R))})}else return M(c,g,$,T,v,A)},ia=async c=>{if(Pt())return Jt(),new Promise((g,$)=>{Ut("end-profiling",[g,$]);let T={type:"end-profiling",in:c};re.postMessage(T)});pr(c)}}),na,wi,$i,bi=z(()=>{"use strict";Je(),aa(),le(),zr(),Yi(),na=(c,g)=>{switch(c.location){case"cpu":return[c.type,c.dims,c.data,"cpu"];case"gpu-buffer":return[c.type,c.dims,{gpuBuffer:c.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[c.type,c.dims,{mlTensor:c.mlTensor},"ml-tensor"];default:throw new Error(`invalid data location: ${c.location} for ${g()}`)}},wi=c=>{switch(c[3]){case"cpu":return new qe(c[0],c[2],c[1]);case"gpu-buffer":{let g=c[0];if(!qr(g))throw new Error(`not supported data type: ${g} for deserializing GPU tensor`);let{gpuBuffer:$,download:T,dispose:v}=c[2];return qe.fromGpuBuffer($,{dataType:g,dims:c[1],download:T,dispose:v})}case"ml-tensor":{let g=c[0];if(!Gr(g))throw new Error(`not supported data type: ${g} for deserializing MLTensor tensor`);let{mlTensor:$,download:T,dispose:v}=c[2];return qe.fromMLTensor($,{dataType:g,dims:c[1],download:T,dispose:v})}default:throw new Error(`invalid data location: ${c[3]}`)}},$i=class{async fetchModelAndCopyToWasmMemory(c){return ta(await Wr(c))}async loadModel(c,g){tt();let $;typeof c=="string"?$=await this.fetchModelAndCopyToWasmMemory(c):$=c,[this.sessionId,this.inputNames,this.outputNames,this.inputMetadata,this.outputMetadata]=await ra($,g),Ye()}async dispose(){return Ia(this.sessionId)}async run(c,g,$){tt();let T=[],v=[];Object.entries(c).forEach(U=>{let D=U[0],Y=U[1],O=this.inputNames.indexOf(D);if(O===-1)throw new Error(`invalid input '${D}'`);T.push(Y),v.push(O)});let A=[],k=[];Object.entries(g).forEach(U=>{let D=U[0],Y=U[1],O=this.outputNames.indexOf(D);if(O===-1)throw new Error(`invalid output '${D}'`);A.push(Y),k.push(O)});let I=T.map((U,D)=>na(U,()=>`input "${this.inputNames[v[D]]}"`)),R=A.map((U,D)=>U?na(U,()=>`output "${this.outputNames[k[D]]}"`):null),N=await hr(this.sessionId,v,I,k,R,$),F={};for(let U=0;U<N.length;U++)F[this.outputNames[k[U]]]=A[U]??wi(N[U]);return Ye(),F}startProfiling(){}endProfiling(){ia(this.sessionId)}}}),Zr={};_e(Zr,{OnnxruntimeWebAssemblyBackend:()=>xi,initializeFlags:()=>vi,wasmBackend:()=>Si});var vi,xi,Si,sa=z(()=>{"use strict";Je(),aa(),bi(),vi=()=>{(typeof te.wasm.initTimeout!="number"||te.wasm.initTimeout<0)&&(te.wasm.initTimeout=0);let c=te.wasm.simd;if(typeof c!="boolean"&&c!==void 0&&c!=="fixed"&&c!=="relaxed"&&(console.warn(`Property "env.wasm.simd" is set to unknown value "${c}". Reset it to \`false\` and ignore SIMD feature checking.`),te.wasm.simd=!1),typeof te.wasm.proxy!="boolean"&&(te.wasm.proxy=!1),typeof te.wasm.trace!="boolean"&&(te.wasm.trace=!1),typeof te.wasm.numThreads!="number"||!Number.isInteger(te.wasm.numThreads)||te.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)te.wasm.numThreads=1;else{let g=typeof navigator>"u"?ge("node:os").cpus().length:navigator.hardwareConcurrency;te.wasm.numThreads=Math.min(4,Math.ceil((g||1)/2))}},xi=class{async init(c){vi(),await yi(),await _i(c)}async createInferenceSessionHandler(c,g){let $=new $i;return await $.loadModel(c,g),$}},Si=new xi}),oa={};_e(oa,{InferenceSession:()=>Ir,TRACE:()=>Zt,TRACE_EVENT_BEGIN:()=>lt,TRACE_EVENT_END:()=>dt,TRACE_FUNC_BEGIN:()=>tt,TRACE_FUNC_END:()=>Ye,Tensor:()=>qe,default:()=>un,env:()=>te,registerBackend:()=>we}),Je(),Je(),Je();var za="1.30.0",un=Ri;{let c=(sa(),je(Zr)).wasmBackend;we("cpu",c,10),we("wasm",c,10)}return Object.defineProperty(te.versions,"web",{value:za,enumerable:!0}),je(oa)})();V.exports=se})(Sc);var Uh=Sc.exports;(function(V){var ie=ct&&ct.__createBinding||(Object.create?function(Oe,xe,ve,Ae){Ae===void 0&&(Ae=ve);var de=Object.getOwnPropertyDescriptor(xe,ve);(!de||("get"in de?!xe.__esModule:de.writable||de.configurable))&&(de={enumerable:!0,get:function(){return xe[ve]}}),Object.defineProperty(Oe,Ae,de)}:function(Oe,xe,ve,Ae){Ae===void 0&&(Ae=ve),Oe[Ae]=xe[ve]}),se=ct&&ct.__setModuleDefault||(Object.create?function(Oe,xe){Object.defineProperty(Oe,"default",{enumerable:!0,value:xe})}:function(Oe,xe){Oe.default=xe}),Z=ct&&ct.__importStar||function(Oe){if(Oe&&Oe.__esModule)return Oe;var xe={};if(Oe!=null)for(var ve in Oe)ve!=="default"&&Object.prototype.hasOwnProperty.call(Oe,ve)&&ie(xe,Oe,ve);return se(xe,Oe),xe};Object.defineProperty(V,"__esModule",{value:!0}),V.MicVAD=V.getDefaultRealTimeVADOptions=V.ort=V.DEFAULT_MODEL=void 0;const ue=Z(Uh),he=Ei,fe=rr,ge=br,z=oi,_e=ws,We=ka;V.DEFAULT_MODEL="legacy",V.ort=ue;const je="vad.worklet.bundle.min.js",$e={legacy:"silero_vad_legacy.onnx",v5:"silero_vad_v5.onnx",v6:"silero_vad_v6.onnx"},be=Oe=>({...fe.defaultFrameProcessorOptions,onFrameProcessed:()=>{},onVADMisfire:()=>{ge.log.debug("VAD misfire")},onSpeechStart:()=>{ge.log.debug("Detected speech start")},onSpeechEnd:()=>{ge.log.debug("Detected speech end")},onSpeechRealStart:()=>{ge.log.debug("Detected real speech start")},baseAssetPath:"./",onnxWASMBasePath:"./",model:Oe,workletOptions:{},getStream:async()=>await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,autoGainControl:!0,noiseSuppression:!0}}),pauseStream:async xe=>{xe.getTracks().forEach(ve=>{ve.stop()})},resumeStream:async()=>await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:!0,autoGainControl:!0,noiseSuppression:!0}}),ortConfig:xe=>{xe.env.logLevel="error"},startOnLoad:!0,processorType:"auto"});V.getDefaultRealTimeVADOptions=be;const we=Oe=>"audioWorklet"in Oe&&typeof AudioWorkletNode=="function"?"AudioWorklet":"ScriptProcessor";async function Ne(Oe,xe,ve,Ae,de){await ve.audioWorklet.addModule(Oe),xe.processorOptions={...xe.processorOptions??{},frameSamples:Ae};const Ve=new AudioWorkletNode(ve,"vad-helper-worklet",xe);return Ve.port.onmessage=async te=>{const et=te.data;if(!(typeof et=="object"&&et&&"message"in et)){console.error("Invalid message event",et);return}switch(et.message){case z.Message.AudioFrame:{if(!("data"in et&&et.data instanceof ArrayBuffer)){console.log("Audio frame message has no data");return}const ht=new Float32Array(et.data);await de(ht);break}}},Ve}async function He(Oe,xe,ve){const Ae=new We.Resampler({nativeSampleRate:Oe.sampleRate,targetSampleRate:16e3,targetFrameSize:xe});ge.log.debug("using script processor");const Ve=Oe.createScriptProcessor(4096,1,1);let te=!1;return Ve.onaudioprocess=async et=>{if(!te){te=!0;try{const ht=et.inputBuffer.getChannelData(0);et.outputBuffer.getChannelData(0).fill(0);const zt=Ae.process(ht);for(const St of zt)await ve(St)}catch(ht){console.error("Error processing audio:",ht)}finally{te=!1}}},Ve.connect(Oe.destination),Ve}class ut{constructor(xe,ve,Ae,de,Ve=!1,te=null,et=null,ht=null,Bt=null,zt=null,St=null,vr="uninitialized",xr=!1){this.options=xe,this.frameProcessor=ve,this.model=Ae,this.frameSamples=de,this.listening=Ve,this.errored=te,this._stream=et,this._audioContext=ht,this._vadNode=Bt,this._mediaStreamAudioSourceNode=zt,this._audioProcessorAdapterType=St,this.initializationState=vr,this.ownsAudioContext=xr,this.getAudioInstances=()=>{if(this._stream===null||this._audioContext===null||this._vadNode==null||this._mediaStreamAudioSourceNode==null)throw new Error("MicVAD has null stream, audio context, or processor adapter");return{stream:this._stream,audioContext:this._audioContext,vadNode:this._vadNode,mediaStreamAudioSourceNode:this._mediaStreamAudioSourceNode}},this.setErrored=Be=>{this.initializationState="errored",this.errored=Be},this.start=async()=>{switch(this.initializationState){case"uninitialized":{ge.log.debug("initializing micVAD"),this.initializationState="initializing",this.frameProcessor.resume();try{this._stream=await this.options.getStream()}catch(Be){throw Be instanceof Error?this.setErrored(Be.message):this.setErrored(String(Be)),Be}if(this.options.audioContext?(console.log("using custom audio context"),this._audioContext=this.options.audioContext):(console.log("using default audio context"),this._audioContext=new AudioContext,this.ownsAudioContext=!0),!this._audioContext)throw this.setErrored("Audio context is null"),Error("Audio context is null");switch(this._audioProcessorAdapterType=this.options.processorType=="auto"?we(this._audioContext):this.options.processorType,this._audioProcessorAdapterType){case"AudioWorklet":this._vadNode=await Ne(this.options.baseAssetPath+je,this.options.workletOptions,this._audioContext,this.frameSamples,this.processFrame);break;case"ScriptProcessor":this._vadNode=await He(this._audioContext,this.frameSamples,this.processFrame);break;default:throw new Error(`Unsupported audio processor adapter type: ${this._audioProcessorAdapterType}`)}this._mediaStreamAudioSourceNode=new MediaStreamAudioSourceNode(this._audioContext,{mediaStream:this._stream}),this._mediaStreamAudioSourceNode.connect(this._vadNode),ge.log.debug("started micVAD"),this.listening=!0,this.initializationState="initialized";break}case"initializing":{ge.log.warn("start called while initializing");break}case"initialized":{if(this.listening)return;this.listening=!0,this.frameProcessor.resume();const{stream:Be,audioContext:Ct,vadNode:Sr}=this.getAudioInstances();this._stream=await this.options.resumeStream(Be);const ui=new MediaStreamAudioSourceNode(Ct,{mediaStream:this._stream});this._mediaStreamAudioSourceNode=ui,ui.connect(Sr);break}case"destroyed":{ge.log.warn("start called after destroyed");break}case"errored":{ge.log.error("start called after errored");break}default:{ge.log.warn("weird initialization state");break}}},this.pause=async()=>{if(!this.listening)return;this.listening=!1;const{stream:Be,mediaStreamAudioSourceNode:Ct}=this.getAudioInstances();await this.options.pauseStream(Be),Ct.disconnect(),this.frameProcessor.pause(this.handleFrameProcessorEvent)},this.destroy=async()=>{var Ct;ge.log.debug("destroy called"),this.initializationState="destroyed";const{vadNode:Be}=this.getAudioInstances();Be instanceof AudioWorkletNode&&Be.port.postMessage(z.Message.SpeechStop),this.listening&&await this.pause(),await this.model.release(),this.ownsAudioContext&&await((Ct=this._audioContext)==null?void 0:Ct.close())},this.setOptions=Be=>{this.frameProcessor.setOptions(Be)},this.processFrame=async Be=>{await this.frameProcessor.process(Be,this.handleFrameProcessorEvent)},this.handleFrameProcessorEvent=Be=>{switch(Be.msg){case z.Message.FrameProcessed:this.options.onFrameProcessed(Be.probs,Be.frame);break;case z.Message.SpeechStart:this.options.onSpeechStart();break;case z.Message.SpeechRealStart:this.options.onSpeechRealStart();break;case z.Message.VADMisfire:this.options.onVADMisfire();break;case z.Message.SpeechEnd:this.options.onSpeechEnd(Be.audio);break}}}static async new(xe={}){const ve={...(0,V.getDefaultRealTimeVADOptions)(xe.model??V.DEFAULT_MODEL),...xe};(0,fe.validateOptions)(ve),V.ort.env.wasm.wasmPaths=ve.onnxWASMBasePath,ve.ortConfig!==void 0&&ve.ortConfig(V.ort);const Ae=ve.baseAssetPath+$e[ve.model],de=ve.model==="legacy"?_e.SileroLegacy.new:_e.Silero.new;let Ve;try{Ve=await de(V.ort,()=>(0,he.defaultModelFetcher)(Ae))}catch(zt){throw console.error(`Encountered an error while loading model file ${Ae}`),zt}const te=ve.model==="legacy"?1536:512,et=te/16,ht=new fe.FrameProcessor(Ve.process,Ve.reset_state,{positiveSpeechThreshold:ve.positiveSpeechThreshold,negativeSpeechThreshold:ve.negativeSpeechThreshold,redemptionMs:ve.redemptionMs,preSpeechPadMs:ve.preSpeechPadMs,minSpeechMs:ve.minSpeechMs,submitUserSpeechOnPause:ve.submitUserSpeechOnPause},et),Bt=new ut(ve,ht,Ve,te);if(ve.startOnLoad)try{await Bt.start()}catch(zt){throw console.error("Error starting micVad",zt),zt}return Bt}}V.MicVAD=ut})(xc);(function(V){Object.defineProperty(V,"__esModule",{value:!0}),V.getDefaultRealTimeVADOptions=V.MicVAD=V.DEFAULT_MODEL=V.utils=V.NonRealTimeVAD=V.Message=V.FrameProcessor=V.defaultModelFetcher=V.baseAssetPath=void 0;var ie=Ea;Object.defineProperty(V,"baseAssetPath",{enumerable:!0,get:function(){return ie.baseAssetPath}});var se=Ei;Object.defineProperty(V,"defaultModelFetcher",{enumerable:!0,get:function(){return se.defaultModelFetcher}});var Z=rr;Object.defineProperty(V,"FrameProcessor",{enumerable:!0,get:function(){return Z.FrameProcessor}});var ue=oi;Object.defineProperty(V,"Message",{enumerable:!0,get:function(){return ue.Message}});var he=mc;Object.defineProperty(V,"NonRealTimeVAD",{enumerable:!0,get:function(){return he.NonRealTimeVAD}});const fe=tr;V.utils={audioFileToArray:fe.audioFileToArray,minFramesForTargetMS:fe.minFramesForTargetMS,arrayBufferToBase64:fe.arrayBufferToBase64,encodeWAV:fe.encodeWAV};var ge=xc;Object.defineProperty(V,"DEFAULT_MODEL",{enumerable:!0,get:function(){return ge.DEFAULT_MODEL}}),Object.defineProperty(V,"MicVAD",{enumerable:!0,get:function(){return ge.MicVAD}}),Object.defineProperty(V,"getDefaultRealTimeVADOptions",{enumerable:!0,get:function(){return ge.getDefaultRealTimeVADOptions}})})(_s);const Nh=xh(_s),Vh=Sh({__proto__:null,default:Nh},[_s]);export{Vh as i};
