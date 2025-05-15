/* 获取学在浙大quiz的答案 */

import * as inquirer from "@inquirer/prompts";
import { COURSES, ZJUAM } from "../login-ZJU.js";

import "dotenv/config";

const courses = new COURSES(
  new ZJUAM(process.env.ZJU_USERNAME, process.env.ZJU_PASSWORD)
);

(async () => {
  courses
    .fetch(
      "https://courses.zju.edu.cn/api/my-semesters?fields=id,name,sort,is_active,code"
    )
    .then((v) => v.json())
    .then(({ semesters }) => {
      return semesters.filter((semester) => semester.is_active);
    })
    .then(async (semesters) => {
      // console.log(semesters);
      const coursesFetchParam = new URLSearchParams();
      coursesFetchParam.set("page", "1");
      coursesFetchParam.set("page_size", "1000");
      coursesFetchParam.set("sort", "all");
      coursesFetchParam.set("normal", '{"version":7,"apiVersion":"1.1.0"}');
      coursesFetchParam.set(
        "conditions",
        JSON.stringify({
          role: [],
          semester_id: semesters.map((v) => v.id),
          academic_year_id: [],
          status: ["ongoing", "notStarted"],
          course_type: [],
          effectiveness: [],
          published: [],
          display_studio_list: false,
        })
      );
      coursesFetchParam.set(
        "fields",
        "id,org_id,name,second_name,department(id,name),instructors(name),grade(name),klass(name),cover,learning_mode,course_attributes(teaching_class_name,data),public_scope,course_type,course_code,compulsory,credit,second_name"
      );

      //   console.log(coursesFetchParam.toString(),decodeURIComponent(coursesFetchParam.toString()));

      return courses
        .fetch(
          "https://courses.zju.edu.cn/api/my-courses?" +
            coursesFetchParam.toString()
        )
        .then((v) => v.json());
    })
    .then(({ courses }) => {
      return inquirer.prompt({
        type: "list",
        name: "course",
        message: "Choose the course to find the quiz:",
        loop:true,
        choices: courses.map((course) => ({
          name: course.name,
          value: course,
        })),
      });
    })
    .then(async ({ course }) => {
      // console.log(course);

      return courses
        .fetch(
          `https://courses.zju.edu.cn/api/courses/${course.id}/classroom-list`
        )
        .then((v) => v.json());
    })
    .then(({ classrooms }) => {
      const choices = classrooms
      .filter((v) => v.status == "start")
      .map((interaction) => ({
        name: interaction.title,
        value: interaction,
      }))
      if(choices.length==0){
        console.log("No active quiz found.");
        throw "No active quiz found.";
        return;
      }
      return inquirer.prompt({
        type: "list",
        name: "classroom",
        message: "Choose the quiz to answer:",
        choices ,
      });
    }).then(async({classroom})=>{
        return courses.fetch(`https://courses.zju.edu.cn/api/classroom/${classroom.id}/result`).then(v=>v.json())
    }).then(oral=>{
        oral.subjects_data.subjects.forEach(rv=>{
            console.log(`Q#${rv.id} -: ${rv.description}`);
            rv.options.filter(rx=>rx.is_answer).forEach(ans=>{
                console.log(`  - Answer: ${String.fromCharCode([65+(ans.sort)])}. ${ans.content}`);
            })
        })
    })
    .catch(e=>{
      console.log("Exit innormaly with error: ",e);
    });
})();
