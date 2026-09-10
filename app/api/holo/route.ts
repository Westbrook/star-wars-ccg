// Legacy records remain in D1 for preservation. The simplified rules endpoint is retired.
function retired(){return Response.json({error:'This prototype used simplified rules and has been retired. Use the GEMP rules service for play.',code:'LEGACY_RULES_RETIRED'},{status:410,headers:{'Cache-Control':'no-store'}})}
export const GET=retired;
export const POST=retired;
