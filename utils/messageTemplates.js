import { format } from "date-fns";

const SCHOOL_NAME = "Dar-e-Arqam School";

const getFormattedTime = (dateStr) => {
  if (!dateStr) return "Scheduled Time";
  return format(new Date(dateStr), "EEEE, MMM do 'at' h:mm a");
};

/**
 * @param {'WELCOME'|'TEST_SCHEDULED'|'TEST_CLEAR'|'ADMISSION'|'FOLLOW_UP'} type
 * @param {Object} inquiry
 * @param {Object} extraData
 */
export const generateMessageTemplate = (type, inquiry, extraData = {}) => {
  const parent = inquiry.fathername;
  const student = inquiry.name;

  switch (type) {
    case 'WELCOME':
      return `Respected *${parent}*,\n\nThank you for visiting *${SCHOOL_NAME}*. We have successfully recorded the admission inquiry for *${student}*.\n\nDo you have any specific questions regarding the curriculum or facilities? \n Admission test syllabus can be found on this link: https://darearqam.vercel.app/admission`;

    case 'TEST_SCHEDULED':
      return `Respected Parent,\n\nThe admission test for *${student}* has been scheduled.\n\n📅 *When:* ${getFormattedTime(extraData.date)}\n\nPlease ensure punctual arrival at the campus. Admission test syllabus can be found on this link: https://darearqam.vercel.app/admission`;

    case 'TEST_CLEAR':
      return `🎉 *Congratulations!*\n\nWe are pleased to inform you that *${student}* has successfully cleared the admission test at *${SCHOOL_NAME}*.\n\nPlease visit the administration office for fee submission and final formalities.`;

    case 'ADMISSION':
      return `✅ *Admission Confirmed*\n\nThe admission process for *${student}* at *${SCHOOL_NAME}* is now complete.\n\nWelcome to the family! 🎓`;

    case 'FOLLOW_UP':
      return `Respected Parent,\n\nYou recently visited *${SCHOOL_NAME}* regarding the admission application for *${student}*.\n\nWould you like to schedule the *Admission Test* now? Please let us know so we can reserve a slot for you.`;

    default:
      return "";
  }
};
