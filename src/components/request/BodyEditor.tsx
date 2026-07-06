import { RequestBody, RequestBodyType } from "../../types/bik";
import { VariableContext } from "../../services/variableResolver";
import { createRequestBody, formatJsonBody, formatXmlBody } from "../../services/requestBody";
import { BinaryBodyPicker } from "./BinaryBodyPicker";
import { GraphQLBodyEditor } from "./GraphQLBodyEditor";
import { JsonBodyEditor } from "./JsonBodyEditor";
import { MultipartFormEditor } from "./MultipartFormEditor";
import { NoBodyState } from "./NoBodyState";
import { RequestBodyTypeSelector } from "./RequestBodyTypeSelector";
import { TextBodyEditor } from "./TextBodyEditor";
import { UrlEncodedFormEditor } from "./UrlEncodedFormEditor";
import { XmlBodyEditor } from "./XmlBodyEditor";
import styles from "./BodyEditor.module.css";

interface BodyEditorProps {
  body: RequestBody;
  bodyError: string | null;
  variableContext?: VariableContext;
  onChange: (body: RequestBody) => void;
}

export function BodyEditor({ body, bodyError, variableContext, onChange }: BodyEditorProps) {
  function changeType(type: RequestBodyType) {
    if (type === body.type) {
      return;
    }
    if (type === "json" && body.type === "json") {
      return;
    }
    onChange(createRequestBody(type));
  }

  return (
    <section className={styles.editor}>
      <div className={styles.topBar}>
        <RequestBodyTypeSelector value={body.type} onChange={changeType} />
      </div>

      {body.type === "json" ? (
        <JsonBodyEditor
          value={body.raw ?? ""}
          error={bodyError}
          variableContext={variableContext}
          onChange={(raw) => onChange({ ...body, raw })}
          onFormat={() => onChange({ ...body, raw: formatJsonBody(body.raw ?? "") })}
        />
      ) : body.type === "xml" ? (
        <XmlBodyEditor
          value={body.raw ?? ""}
          variableContext={variableContext}
          onChange={(raw) => onChange({ ...body, raw })}
          onFormat={() => onChange({ ...body, raw: formatXmlBody(body.raw ?? "") })}
        />
      ) : body.type === "text" ? (
        <TextBodyEditor
          value={body.raw ?? ""}
          variableContext={variableContext}
          onChange={(raw) => onChange({ ...body, raw })}
        />
      ) : body.type === "graphql" ? (
        <GraphQLBodyEditor
          query={body.graphql?.query ?? ""}
          variables={body.graphql?.variables ?? "{\n  \n}"}
          error={bodyError}
          variableContext={variableContext}
          onQueryChange={(query) => onChange({ ...body, graphql: { query, variables: body.graphql?.variables ?? "{\n  \n}" } })}
          onVariablesChange={(variables) => onChange({ ...body, graphql: { query: body.graphql?.query ?? "", variables } })}
          onFormatVariables={() => onChange({
            ...body,
            graphql: {
              query: body.graphql?.query ?? "",
              variables: formatJsonBody(body.graphql?.variables ?? "{\n  \n}"),
            },
          })}
        />
      ) : body.type === "form-urlencoded" ? (
        <UrlEncodedFormEditor
          values={body.form ?? []}
          variableContext={variableContext}
          onChange={(form) => onChange({ ...body, form })}
        />
      ) : body.type === "multipart" ? (
        <MultipartFormEditor
          values={body.multipart ?? []}
          variableContext={variableContext}
          onChange={(multipart) => onChange({ ...body, multipart })}
        />
      ) : body.type === "binary" ? (
        <BinaryBodyPicker value={body.binary} onChange={(binary) => onChange({ ...body, binary })} />
      ) : (
        <NoBodyState />
      )}
    </section>
  );
}
