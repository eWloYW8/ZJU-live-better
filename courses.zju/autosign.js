import { COURSES, ZJUAM } from "../login-ZJU.js";
// import nodeNotifier from "node-notifier";
import "dotenv/config";

const CONFIG = {
  raderAt: "ZJGD1",
};

const courses = new COURSES(
  new ZJUAM(process.env.ZJU_USERNAME, process.env.ZJU_PASSWORD)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let req_num = 0;

// if (false)
(async () => {
  // nodeNotifier.notify({
  //   title:"已开始监听学在浙大签到"
  // })
  while (true) {
    await courses
      .fetch("https://courses.zju.edu.cn/api/radar/rollcalls")
      .then((v) => v.json())
      .then(async (v) => {
        if (v.rollcalls.length == 0) {
          console.log(`[Auto Sign-in](Req #${++req_num}) No rollcalls found.`);
        } else {
          console.log(
            `[Auto Sign-in] Found ${v.rollcalls.length} rollcalls. 
                They are:${v.rollcalls.map(
                  (rc) => `
                  - ${rc.title} @ ${rc.course_title} by ${rc.created_by_name} (${rc.department_name})`
                )}
`
          );
          // console.log(v.rollcalls);

          // nodeNotifier.notify({
          //   title:"检测到学在浙大签到",
          //   message:JSON.stringify(v.rollcalls)
          // })

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

            if (rollcall.status == "on_call") {
              "[Auto Sign-in] Note that #" + rollcallId + " is on call.";
              return;
            }
            console.log("[Auto Sign-in] Now answering rollcall #" + rollcallId);
            if (rollcall.is_radar) {
              answerRaderRollcall(RaderInfo[CONFIG.raderAt], rollcallId);
            }
            if (rollcall.is_number) {
              batchNumberRollCall(rollcallId);
            }
          });
        }
      });

    await sleep(4000);
  }
})();

const RaderInfo = {
  ZJGD1: [120.089136, 30.302331], //东一教学楼
  ZJGX1: [120.085042, 30.30173], //西教学楼
  ZJGB1: [120.077135, 30.305142], //段永平教学楼
};
async function answerRaderRollcall(raderXY, rid) {
  return await courses
    .fetch(
      "https://courses.zju.edu.cn/api/rollcall/" +
        rid +
        "/answer?api_version=1.1.2",
      {
        body: JSON.stringify({
          deviceId: "",
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
          deviceId:"",
          numberCode,
        }),
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          // "X-Session-Id": courses.session,
        },
      }
    )
    .then((vd) => {
      if (vd.status == 404) {
        return false;
      }
      return true;
    });
}

let currentBatchingRCs = [];
async function batchNumberRollCall(rid) {
  if (!currentBatchingRCs.includes(rid)) {
    currentBatchingRCs.push(rid);
    for (let ckn = 0; ckn <= 9999; ckn++) {
      if (ckn % 100 == 0) {
        console.log(
          "[Auto Sign-in] Cracking rollcall number @" +
            ckn +
            " ~ " +
            (ckn + 99) +
            ""
        );
      }
      if (await answerNumberRollcall(ckn.toString(10).padStart(4, "0"), rid)) {
        console.log("[Auto Sign-in] Finished with rollcall number: ", ckn);
        break;
      }
    }
  }
}

// answerRaderRollcall(RaderInfo[CONFIG.raderAt], 171632);

// fetch()
