// Minimal deterministic ZIP writer: stored entries, UTF-8 names, no compression dependency.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function zip(files) {
  const chunks=[],central=[];let offset=0;
  for(const [name,data] of files.sort((a,b)=>a[0].localeCompare(b[0]))) {
    const filename=Buffer.from(name),bytes=Buffer.from(data),crc=crc32(bytes);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(bytes.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(0x800,8);header.writeUInt16LE(33,14);header.writeUInt32LE(crc,16);header.writeUInt32LE(bytes.length,20);header.writeUInt32LE(bytes.length,24);header.writeUInt16LE(filename.length,28);header.writeUInt32LE(offset,42);
    chunks.push(local,filename,bytes);central.push(header,filename);offset+=local.length+filename.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
