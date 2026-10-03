import NativeMatches from '../screen';
export default async function Page({params}:{params:Promise<{id:string}>}){return <NativeMatches id={(await params).id}/>}
