import type {Metadata} from "next";import {redirect} from "next/navigation";import {getCurrentProfile} from "../../../lib/auth/get-current-profile";import QuizManager from "../../shared/quiz/quiz-manager";
export const metadata:Metadata={title:"Latihan dan Kuiz | Ekonomi Smart SMKTM",description:"Pengurusan latihan dan kuiz Ekonomi."};
export default async function TeacherQuizPage(){const p=await getCurrentProfile();if(!p)redirect("/login");if(p.role!=="teacher")redirect(p.role==="admin"?"/admin/kuiz":"/murid/kuiz");return <QuizManager dashboardHref="/guru/dashboard" roleLabel="GURU"/>;}
