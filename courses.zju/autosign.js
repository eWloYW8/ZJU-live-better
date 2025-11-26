import { COURSES, ZJUAM } from "login-zju";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

const CONFIG = {
  raderAt: "ZJGD1",
  coldDownTime: 4000, // 4s
};
const RaderInfo = {
  ZJGD1: [120.089136, 30.302331], //东一教学楼
  ZJGX1: [120.085042, 30.30173], //西教学楼
  ZJGB1: [120.077135, 30.305142], //段永平教学楼
  YQ4: [120.122176,30.261555], //玉泉教四
  YQ1: [120.123853,30.262544], //玉泉教一
  YQ7: [120.120344,30.263907], //玉泉教七
  ZJ1: [120.126008,30.192908], //之江校区1
  HJC1: [120.195939,30.272068], //华家池校区1
  HJC2: [120.198193,30.270419], //华家池校区2
  ZJ2: [120.124267,30.19139], //之江校区2 // 之江校区半径都没500米
  YQSS: [120.124001,30.265735], //虽然大概不会有课在宿舍上但还是放一个点位
  ZJG4: [120.073427,30.299757], //紫金港大西区
};
// 说明: 在这里配置签到地点后，签到会优先【使用配置的地点】尝试
//      随后会尝试遍历RaderInfo中的所有地点
//      如果失败了>3次，则会尝试三点定位法

// 成功率：目前【雷达点名】+【已配置了雷达地点】的情况可以100%签到成功
//        数字点名已测试，已成功，确定远程没有限速，没有calm down，但是目前单线程，可能会有点慢，
//        三点定位法还没写

// 顺便一提，经测试，rader_out_of_scope的限制是500米整


const courses = new COURSES(
  new ZJUAM(process.env.ZJU_USERNAME, process.env.ZJU_PASSWORD)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let req_num = 0;

let we_are_bruteforcing = [];

// if (false)
(async () => {
  while (true) {
    await courses
      .fetch("https://courses.zju.edu.cn/api/radar/rollcalls")
      .then((v) => v.text())
      .then(async (fa) => {
        try {
          return await JSON.parse(fa)
        } catch (e) {
          console.log("[-][Auto Sign-in] Oh no..", e);
          console.log(fa);
        }
      })
  //     .then((v) => v.json())
      .then(async (v) => {
        if (v.rollcalls.length == 0) {
          console.log(`[Auto Sign-in](Req #${++req_num}) No rollcalls found.`);
        } else {
          console.log(
            `[Auto Sign-in](Req #${++req_num}) Found ${v.rollcalls.length} rollcalls. 
                They are:${v.rollcalls.map(
              (rc) => `
                  - ${rc.title} @ ${rc.course_title} by ${rc.created_by_name} (${rc.department_name})`
            )}`
          );
          // console.log(v.rollcalls);



          v.rollcalls.forEach((rollcall) => {
            /**
             * It looks like 
             * 
  {
    avatar_big_url: '',
    class_name: '',
    course_id: 77997,
    course_title: '思想道德与法治',
    created_by: 1835,
    created_by_name: '单珏慧',
    department_name: '马克思主义学院',
    grade_name: '',
    group_set_id: 0,
    is_expired: false,
    is_number: false,
    is_radar: true,
    published_at: null,
    rollcall_id: 171329,
    rollcall_status: 'in_progress',
    rollcall_time: '2024-12-12T10:51:43Z',
    scored: true,
    source: 'radar',
    status: 'absent',
    student_rollcall_id: 0,
    title: '2024.12.12 18:51',
    type: 'another'
  }
             */
            const rollcallId = rollcall.rollcall_id;
            // console.log(rollcall);
            if (rollcall.status == "on_call_fine" || rollcall.status == "on_call" || rollcall.status_name == "on_call_fine" || rollcall.status_name == "on_call") {
              console.log("[Auto Sign-in] Note that #" + rollcallId + " is on call.");
              ;
              return;
            }
            console.log("[Auto Sign-in] Now answering rollcall #" + rollcallId);
            if (rollcall.is_radar) {
              answerRaderRollcall(RaderInfo[CONFIG.raderAt], rollcallId);
            }
            if (rollcall.is_number) {
              if(we_are_bruteforcing.includes(rollcallId)){
                console.log("[Auto Sign-in] We are already bruteforcing rollcall #" + rollcallId);
                return;
              }
              we_are_bruteforcing.push(rollcallId);
              console.log("[Auto Sign-in] Now bruteforcing rollcall #" + rollcall)
              batchNumberRollCall(rollcallId);
            }
          });
        }
      }).catch((e) => {
        console.log(
          `[Auto Sign-in](Req #${++req_num}) Failed to fetch rollcalls: `,
          e
        );
      });

    await sleep(CONFIG.coldDownTime);
  }
})();


async function answerRaderRollcall(raderXY, rid) {
  async function _req(x, y) {
    return await courses
      .fetch(
        "https://courses.zju.edu.cn/api/rollcall/" +
        rid +
        "/answer?api_version=1.1.2",
        {
          body: JSON.stringify({
            deviceId: uuidv4(),
            latitude: y,
            longitude: x,
            speed: null,
            accuracy: 68,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
          }),
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
      .then(async (v) => {
        try {
          return await v.json()
        } catch (e) {
          console.log("[-][Auto Sign-in] Oh no..", e);
        }
      })
  }
  let rader_outcome = []

  // Step 1: Try the configured Rader location
  const RaderXY = RaderInfo[CONFIG.raderAt];
  if (RaderXY) {
    const outcome = await _req(RaderXY[0], RaderXY[1]);
    if (outcome.status_name == "on_call_fine") {
      console.log(
        "[Auto Sign-in] Trying configured Rader location: " +
        CONFIG.raderAt +
        " with outcome: ",
        outcome
      );
      return true;

    } else {
      console.log(
        "[Auto Sign-in] Failed to get outcome from configured Rader location: " +
        CONFIG.raderAt,
        outcome
      );
    }
    rader_outcome.push([RaderXY,outcome]);
  }

  // Step 2: Try all Rader locations
  for (const [key, value] of Object.entries(RaderInfo)) {
    // if (key == CONFIG.raderAt) continue; // Skip the configured Rader location
    console.log("[Auto Sign-in] Trying Rader location: " + key);
    console.log(value[0],value[1]);
    
    const outcome = await _req(value[0], value[1]);
    if (outcome.status_name == "on_call_fine") {
      console.log(
        "[Auto Sign-in] Congradulations! You are on the call at Rader location: " +
        key
      );
      return true;
    }
    rader_outcome.push([value,outcome]);
  }

  // Step 3: If all Rader locations failed, try three-point triangulation
  if (rader_outcome.length > 3) {
    const XYList = rader_outcome.filter(v=>v[1].error_code=="radar_out_of_rollcall_scope").map((v)=>{
      return [v[0][0], v[0][1],v[1].distance];
    })
    // Find the exact distance of the center 

  }
  return await courses
    .fetch(
      "https://courses.zju.edu.cn/api/rollcall/" +
      rid +
      "/answer?api_version=1.1.2",
      {
        body: JSON.stringify({
          deviceId: uuidv4(),
          latitude: raderXY[1],
          longitude: raderXY[0],
          speed: null,
          accuracy: 68,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
        }),
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
    .then((v) => v.text())
    .then((fa) => {
      // console.log(
      //   "[Auto Sign-in] Rader Rollcall answered with an outcome of: ",
      //   fa
      // );
      try {
        const outcome = JSON.parse(fa);
        if (outcome.status_name == "on_call_fine") {
          console.log("[Auto Sign-in] Congradulations! You are on the call.");
        }
      } catch (e) {
        console.log(
          "[Auto Sign-in] Rader Rollcall resulted with unknown outcome: ",
          fa
        );
      }

      /*It should be:
      {
    "distance": 304.71523221805245,
    "id": 4949903,
    "status": "on_call",
    "status_name": "on_call_fine"
}
    or

    {
    "distance": 609.7890115916947,
    "error_code": "radar_out_of_rollcall_scope",
    "id": 4949903,
    "message": "out of rollcall scope",
    "status_name": "absent"
}

*/
    });
}

async function answerNumberRollcall(numberCode, rid) {
  return await courses
    .fetch(
      "https://courses.zju.edu.cn/api/rollcall/" +
      rid +
      "/answer_number_rollcall",
      {
        body: JSON.stringify({
          deviceId: uuidv4(),
          numberCode,
        }),
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          // "X-Session-Id": courses.session,
        },
      }
    )
    .then(async(vd) => {
      // console.log(vd.status, vd.statusText);
      // console.log(await vd.text());
      /*
      When fail:
      400 BAD REQUEST
      {"error_code":"wrong_number_code","message":"wrong number code","number_code":"6921"}
      When success:
      200 OK
      {"id":5427153,"status":"on_call"}

       */

      
      if (vd.status != 200 || vd.error_code?.includes("wrong")) {
        return false;
      }
      return true;
    });
}

let currentBatchingRCs = [];
async function batchNumberRollCall(rid) {
  if (currentBatchingRCs.includes(rid)) return;

  currentBatchingRCs.push(rid);

  const batchSize = 200;
  let found = null;

  for (let start = 0; start <= 9999; start += batchSize) {
    const end = Math.min(start + batchSize - 1, 9999);

    console.log(`[Auto Sign-in] Cracking rollcall number batch: [${start} ~ ${end}]`);

    const tasks = [];

    for (let ckn = start; ckn <= end; ckn++) {
      const code = ckn.toString().padStart(4, "0");

      tasks.push(
        answerNumberRollcall(code, rid).then(success => {
          if (success && !found) found = code;
          return success;
        })
      );
    }
    await Promise.all(tasks);

    console.log(`[Auto Sign-in] Batch [${start} ~ ${end}] completed.`);
  }

  if (found) {
    console.log("[Auto Sign-in] At least one successful rollcall number found:", found);
  } else {
    console.log("[Auto Sign-in] No valid rollcall number found in 0-9999.");
  }
}


// answerRaderRollcall(RaderInfo[CONFIG.raderAt], 171632);

// fetch()
