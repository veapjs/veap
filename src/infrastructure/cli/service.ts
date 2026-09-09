import cac from "cac";
import { Injectable } from "../ioc/decorators.js";

@Injectable()
export class CliService {
  public program = cac("veap");
}
