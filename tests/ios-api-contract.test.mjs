import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('Swift client keeps interaction cookies, false and zero values, and rejects server failures', {skip:process.platform!=='darwin'}, async()=>{
  const requests=[];
  const server=createServer(async(req,res)=>{
    let raw=''; for await(const chunk of req) raw+=chunk;
    requests.push({method:req.method,url:req.url,cookie:req.headers.cookie,origin:req.headers.origin,body:raw?JSON.parse(raw):null});
    res.setHeader('Content-Type','application/json');
    if(req.url.includes('unavailable')){res.writeHead(503);res.end('{}');return;}
    if(req.method==='GET') res.setHeader('Set-Cookie','alelm-reader=fixture-reader; Path=/; HttpOnly');
    res.end(JSON.stringify({liked:false,closingAnswer:0,counts:[7,3]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const dir=await mkdtemp(join(tmpdir(),'alelm-swift-api-'));
  try{
    const source=`
import Foundation
struct StoryCard: Decodable {}
struct MobileHomePayload: Decodable {}
struct StoryDetailPayload: Decodable {}
struct SeriesIndexPayload: Decodable {}
struct SeriesFeedPayload: Decodable {}
struct SearchPayload: Decodable {}
struct ForYouPayload: Decodable {}
enum URLConstants {
 static let productionAPI = URL(string: ProcessInfo.processInfo.environment["TEST_ORIGIN"]!)!
 static var memberAPI: URL { productionAPI }
 static func mobileHome(on origin: URL) -> URL { origin }
 static func webHome(on origin: URL) -> URL { origin }
}
@main struct Check {
 static func main() async throws {
  let first = try await APIClient.fetchInteraction(storyId: "fixture")
  precondition(first.counts == [7, 3] && first.closingAnswer == 0 && !first.liked)
  _ = try await APIClient.saveInteraction(storyId: "fixture", liked: false)
  _ = try await APIClient.saveInteraction(storyId: "fixture", answer: 0)
  do {
   _ = try await APIClient.fetchInteraction(storyId: "unavailable")
   preconditionFailure("503 accepted")
  } catch APIClientError.badStatus(let status) { precondition(status == 503) }
 }
}
`;
    await writeFile(join(dir,'Check.swift'),source);
    await exec('xcrun',['swiftc','-parse-as-library','ios/Elm/Services/APIClient.swift',join(dir,'Check.swift'),'-o',join(dir,'check')]);
    await exec(join(dir,'check'),[],{env:{...process.env,TEST_ORIGIN:origin}});
    assert.equal(requests.length,4);
    assert.match(requests[1].cookie,/alelm-reader=fixture-reader/);
    assert.equal(requests[1].origin,origin);
    assert.deepEqual(requests[1].body,{storyId:'fixture',liked:false});
    assert.deepEqual(requests[2].body,{storyId:'fixture',answer:0});
  }finally{server.close();await rm(dir,{recursive:true,force:true});}
});
