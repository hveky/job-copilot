import type { Resume } from "../state/resume";

export function ResumeDocument({ resume }: { resume: Resume }) {
  const { basics, experience, education, skills, projects, links } = resume;

  const contactParts = [
    basics.phone,
    basics.email,
    basics.location,
    ...links.map((l) => l.url || l.label),
  ].filter(Boolean);

  return (
    <div className="resume-doc">
      <h1>{basics.name || "姓名"}</h1>
      {basics.headline && <p className="resume-headline">{basics.headline}</p>}
      {contactParts.length > 0 && (
        <p className="resume-contact">{contactParts.join(" · ")}</p>
      )}
      {basics.summary && (
        <section>
          <h2>个人简介</h2>
          <p>{basics.summary}</p>
        </section>
      )}

      {experience.length > 0 && (
        <section>
          <h2>工作经历</h2>
          {experience.map((exp, i) => (
            <div key={i} className="resume-entry">
              <div className="resume-entry-header">
                <span className="resume-entry-title">
                  {exp.role}{exp.company ? ` @ ${exp.company}` : ""}
                </span>
                <span className="resume-entry-period">
                  {[exp.start, exp.end].filter(Boolean).join(" – ")}
                </span>
              </div>
              {exp.bullets && exp.bullets.length > 0 && (
                <ul>
                  {exp.bullets.filter(Boolean).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {education.length > 0 && (
        <section>
          <h2>教育</h2>
          {education.map((edu, i) => (
            <div key={i} className="resume-entry">
              <div className="resume-entry-header">
                <span className="resume-entry-title">
                  {edu.school}
                  {edu.degree || edu.major
                    ? ` · ${[edu.degree, edu.major].filter(Boolean).join(" ")}`
                    : ""}
                </span>
                <span className="resume-entry-period">
                  {[edu.start, edu.end].filter(Boolean).join(" – ")}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <h2>技能</h2>
          <p>{skills.join(" · ")}</p>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2>项目</h2>
          {projects.map((proj, i) => (
            <div key={i} className="resume-entry">
              <div className="resume-entry-title">{proj.name}</div>
              {proj.desc && <p style={{ margin: "4px 0 0" }}>{proj.desc}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
