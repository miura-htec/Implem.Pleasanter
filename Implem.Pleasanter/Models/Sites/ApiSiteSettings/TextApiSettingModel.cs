using Implem.Pleasanter.Libraries.Settings;
using System;

namespace Implem.Pleasanter.Models.ApiSiteSettings
{
    [Serializable]
    public class TextApiSettingModel
    {
        public int Id;
        public string LabelText;

        public TextApiSettingModel()
        {
        }

        public Text GetRecordingData(SiteSettings ss)
        {
            return new Text
            {
                Id = Id,
                LabelText = LabelText
            };
        }
    }
}
